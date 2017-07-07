/*global angular, firebase*/
/*jslint node:true*/
'use strict';

function sanitizeStringForFirebase(badString) {
  let sanitizedString = '';
  
  sanitizedString = badString.replace(/[\.#$/\[\]]/g, "-");
  
  return sanitizedString;
}

// https://gist.github.com/christopherscott/2782634
function excelToJsDate(excelDate) {
  return new Date((excelDate - (25567 + 1)) * 86400 * 1000);
}

/**
 * Takes javascript Date object. Outputs string in format DD MMM (1 June, 
 * 7 Aug, etc.)
 */
function formatJsDate(jsDate) {
  const monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];

  const day = jsDate.getDate();
  const monthIndex = jsDate.getMonth();
  const year = jsDate.getFullYear();

  return day + ' ' + monthNames[monthIndex];
}

function roundToCents(floatNum) {
  return Math.round(floatNum * 100) / 100;
}

Number.prototype.round = function(p) {
  p = p || 2;
  return parseFloat(this.toFixed(p));
}

function getNumTo2Decimals(floatNum) {
  return parseFloat((floatNum).toFixed(2));
}

function to_json(workbook) {
  let result = {};
  
  workbook.SheetNames.forEach(function(sheetName) {
    let roa = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
    
    if(roa.length > 0){
      result[sheetName] = roa;
    }
  });
  
  return result;
}

function process_wb(wb) {
  var output = "";
  
  output = to_json(wb);
  
  return output;
}

angular
.module('baidahocpasToolsApp')
.controller('purebarreSettingsCtrl', ['$firebaseArray', '$scope', '$state', 'Auth', 'NAV_LINKS',
function ($firebaseArray, $scope, $state, Auth, NAV_LINKS) {
  $scope.siteNavLinks = NAV_LINKS.internal;
  
  // Auth
  $scope.Auth = Auth;
  $scope.user = Auth.$getAuth();
  $scope.signOut = function () {
    Auth.$signOut();
    $scope.user = null;
    Auth.$onAuthStateChanged(function (firebaseUser) {
      if (firebaseUser) {
        $scope.user = firebaseUser;
        $scope.errorNotice = 'Unable to sign out.';
      } else {
        $state.go('login');
      }
    });
  };
  
  $scope.pbStudios = [];
  const pbStudiosRef = firebase.database().ref('/purebarre/studios');
  $scope.pbStudios = $firebaseArray(pbStudiosRef);
  // pbStudiosRef.on('child_added', function(snapshot) {
  //   $scope.pbStudios.push(snapshot.val().name);
  // });
  
  /**
   * PUREBARRE CONSTANTS
   */
  
  /**
   * PARSE WORKBOOK
   */
  
  // Set value for progress-bar
  function setUploadProgress() {
    if ($scope.uploadWorkbookRowCount > 0) {
      $scope.uploadProgress = $scope.uploadSuccessCount / $scope.uploadWorkbookRowCount * 100;
    }
  }
  
  $scope.uploadFormData = {};
  $scope.uploadFormSubmitted = false;
  $scope.uploadFormData.studioName = '';
  let uploadWorkbook = null;
  $scope.uploadWorkbookRowCount = 0;
  $scope.uploadSuccessCount = 0;
  $scope.uploadErrorCount = 0;
  $scope.uploadProgress = 0.0;
  
  $scope.assignStudioName = function(dropdownStudioName) {
    $scope.uploadFormData.studioName = dropdownStudioName;
  }
  
  // Upload workbook of sales data
  function uploadNewInventoryList () {
    // Get uploadStudioName from submitted form
    const uploadStudioName = $scope.uploadFormData.studioName;
    console.log('Studio: ' + uploadStudioName);
    
    // Set database entry point for new uploads
    const uploadEntryPoint = 'purebarre/studios/' + sanitizeStringForFirebase(uploadStudioName);
    const purebarreSettingsUploadRef = firebase.database().ref(uploadEntryPoint);
    
    // Get JSON data from workbook from submitted form
    const rawWorkbook = XLSX.read(uploadWorkbook, {type: 'binary'});
    const wb = process_wb(rawWorkbook);
    
    // Save worksheet name
    const inventoryWorksheetName = Object.keys(wb)[0];
    console.log('Inventory worksheet name: ' + inventoryWorksheetName);
    
    $scope.uploadWorkbookRowCount = wb[inventoryWorksheetName].length;
    console.log('Rows: ' + $scope.uploadWorkbookRowCount);
    
    // Get current timestamp
    const rightNowTimestamp = new Date();
    const rightNowISO = rightNowTimestamp.toISOString();
    console.log(rightNowISO);
    
    // Create new entry in uploadEntryPoint
    const newPBSettingsUploadRef = firebase.database().ref(uploadEntryPoint);
    
    /**
     * Remove all data at uploadEntryPoint.
     * 
     * Fixes bug that prevented database from updating when updating inventory
     * data.
     */
    newPBSettingsUploadRef.remove();
    
    // Set meta info about upload
    newPBSettingsUploadRef.set({
      date: rightNowISO,
      name: uploadStudioName,
    });
    
    // Push sales data from workbook to [uploadEntryPoint]/inventoryData
    const inventoryDataUploadPath = uploadEntryPoint + '/inventoryData';
    const newPBSettingsData = firebase.database().ref(inventoryDataUploadPath);
    
    // Attach listener for successful data upload
    // https://firebase.google.com/docs/database/web/lists-of-data#listen_for_child_events
    newPBSettingsData.on('child_added', function(data) {
      // On successful upload, update progress bar on DOM
      $scope.uploadSuccessCount += 1;
      setUploadProgress();
    });
    
    // Upload data from 'Sales' sheet
    wb[inventoryWorksheetName].forEach(function(row) {
      let inventoryRecord = {};
      
      for (var recordKey in row) {
        const key = recordKey;
        const value = row[recordKey];
        inventoryRecord[sanitizeStringForFirebase(key)] = value;
      }
      
      newPBSettingsData.push(inventoryRecord);
    }, this);
  };
  
  $scope.submitUpload = function() {
    $scope.uploadFormSubmitted = true;
    console.log($scope.uploadFormData.studioName);
    
    // Get file upload
    // http://stackoverflow.com/a/22538760/5623385
    var f = document.getElementById('inputFile').files[0],
        r = new FileReader();
    r.onloadend = function(e){
      var data = e.target.result;
      // console.log(data);
      //send your binary data via $http or $resource or do anything else with it
      uploadWorkbook = data;
      
      uploadNewInventoryList();
    }
    r.readAsBinaryString(f);
  }
  
}]);
