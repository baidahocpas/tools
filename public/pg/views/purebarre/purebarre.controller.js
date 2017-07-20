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
.controller('purebarreCtrl', ['$firebaseArray', '$scope', '$state', 'Auth', 'NAV_LINKS',
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
  // Array to hold inventory data for studio from firebase
  const inventoryData = [];
  
  // Path for freshly-uploaded data
  let uploadPath = '';
  const pbSubtotal = 'Subtotal';
  const pbDate = 'Sale Date';
  const pbLocation = 'Location';
  const pbPaymentMethod = 'Payment Method';
  const pbTotalPaidWPaymentMethod = 'Total Paid w- Payment Method';
  const pbTax = 'Tax';
  const pbDiscountAmount = 'Discount amount';
  const pbItemName = 'Item name';
  const pbItemTotal = 'Item Total';
  const pbRemainingBalance = 'Remaining Balance';
  
  const outCashSales = 'Cash Sales';
  const outCreditSales = 'Credit Sales';
  const outClass = 'Class';
  const outClassDiscount = 'Class Discount';
  const outProduct = 'Product';
  const outProductDiscount = 'Product Discount';
  const outFoodProduct = 'Food Product';
  const outFoodProductTax = 'Food Product Tax';
  const outLateFee = 'Late Cancellation Fee';
  const outGiftCard = 'Gift Card';
  const outTax = 'Tax';
  const outTotal = 'Total Deposit';
  const outNoAuth = 'No auth';
  
  const foodProductsList = [
    'water',
  ];
  
  const giftCardsList = [
    'card',
    'certificate',
  ];
  
  const lateFeeList = [
    'cancel',
    'cancellation',
  ];
  
  /**
   * PARSE WORKBOOK
   */
  // Set constants for workbook parsing
  const salesSheetName = 'Sales';
  const depositsSheetName = 'Deposits';
  
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
  
  $scope.setUploadStudioName = function(studioName) {
    $scope.uploadFormData.studioName = studioName;
  }
  
  // Set database entry point for new uploads
  const uploadEntryPoint = 'purebarre/uploads/';
  const purebarreUploadRef = firebase.database().ref(uploadEntryPoint);
  
  // Upload workbook of sales data
  function uploadNewSales () {
    // Get uploadStudioName from submitted form
    const uploadStudioName = $scope.uploadFormData.studioName;
    
    // Get JSON data from workbook from submitted form
    const rawWorkbook = XLSX.read(uploadWorkbook, {type: 'binary'});
    const wb = process_wb(rawWorkbook);
    console.log(wb);
    
    // Get length of data from workbook (use later for error checking)
    if (wb.Deposits != null) {
      $scope.uploadWorkbookRowCount = wb.Sales.length + wb.Deposits.length;
    } else {
      $scope.uploadWorkbookRowCount = wb.Sales.length;
    }
    
    console.log('Rows: ' + $scope.uploadWorkbookRowCount);
    
    // Get current timestamp
    const rightNowTimestamp = new Date();
    const rightNowISO = rightNowTimestamp.toISOString();
    console.log(rightNowISO);
    
    // Create new entry in uploadEntryPoint
    const newPBUploadRef = purebarreUploadRef.push();
    
    // Set meta info about upload
    newPBUploadRef.set({
      date: rightNowISO,
      studio: uploadStudioName,
    });
    
    // Push sales data from workbook to [uploadEntryPoint]/data
    uploadPath = uploadEntryPoint + newPBUploadRef.getKey() + '/data';
    const newPBSalesDataRef = firebase.database().ref(uploadPath);
    
    // Attach listener for successful data upload
    // https://firebase.google.com/docs/database/web/lists-of-data#listen_for_child_events
    newPBSalesDataRef.on('child_added', function(data) {
      // On successful upload, update progress bar on DOM
      $scope.uploadSuccessCount += 1;
      setUploadProgress();
    });
    
    // Upload data from 'Sales' sheet
    wb[salesSheetName].forEach(function(row) {
      let saleRecord = {};
      
      for (var recordKey in row) {
        const key = recordKey;
        const value = row[recordKey];
        saleRecord[sanitizeStringForFirebase(key)] = value;
      }
      
      newPBSalesDataRef.push(saleRecord);
    }, this);
    
    // Upload data from 'Deposits' sheet
    if(wb[depositsSheetName] != null) {
      wb[depositsSheetName].forEach(function(row) {
        let depositRecord = {};
        
        for (var recordKey in row) {
          const key = recordKey;
          const value = row[recordKey];
          depositRecord[sanitizeStringForFirebase(key)] = value;
        }
        
        newPBSalesDataRef.push(depositRecord);
      }, this);
    }
    
    // Save inventory data from firebase to local variable
    const inventoryDataRef = firebase.database().ref('purebarre/studios/' + sanitizeStringForFirebase(uploadStudioName) + '/inventoryData');
    inventoryDataRef.on('child_added', function(data) {
      console.log(data.val());
      inventoryData.push(data.val()['Product Name']);
    });
  };
  
  $scope.submitUpload = function() {
    $scope.uploadFormSubmitted = true;
    
    // Get file upload
    // http://stackoverflow.com/a/22538760/5623385
    var f = document.getElementById('inputFile').files[0],
        r = new FileReader();
    r.onloadend = function(e){
      var data = e.target.result;
      // console.log(data);
      //send your binary data via $http or $resource or do anything else with it
      uploadWorkbook = data;
      
      uploadNewSales();
    }
    r.readAsBinaryString(f);
  }
  
  /**
   * ANALYZE UPLOADED DATA
   */
  // Settings
  $scope.analyzePBDataSettings = {
    separateByPaymentMethod: true,
    separateByLocation: false,
  };
  
  // Settings (persist without modeling to checkboxes on form)
  $scope.analyzePBDataSettingsPersist = {
    separateByPaymentMethod: true,
    separateByLocation: false,
  }
  
  $scope.analyzePBData = function() {
    console.log(inventoryData);
    const pbData = {};
    $scope.analyzePBDataSettingsPersist.separateByPaymentMethod = $scope.analyzePBDataSettings.separateByPaymentMethod;
    $scope.analyzePBDataSettingsPersist.separateByLocation = $scope.analyzePBDataSettings.separateByLocation;
    
    // Get data from Firebase
    const pbDataRef = firebase.database().ref(uploadPath);
    pbDataRef.once('value', function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        const childKey = childSnapshot.key;
        const childData = childSnapshot.val();
        
        // Save the relevant info from each transaction
        //const saleDate = formatJsDate(excelToJsDate(childData[pbDate]));
        let saleDate = childData[pbDate];
        if (saleDate > 40000) {
          saleDate = formatJsDate(excelToJsDate(saleDate));
        }
        
        const saleLocation = childData[pbLocation];
        const saleTax = parseFloat(childData[pbTax]);
        const saleDiscountAmount = parseFloat(childData[pbDiscountAmount]);
        const salePaymentMethod = childData[pbPaymentMethod];
        let saleTotalPaidWPaymentMethod = 0.0;
        
        let isDeposit = false;
        // If deposit, calculate total paid
        if (!childData.hasOwnProperty(pbTotalPaidWPaymentMethod)) {
          isDeposit = true;
          saleTotalPaidWPaymentMethod = parseFloat(childData[pbItemTotal]) - parseFloat(childData[pbRemainingBalance]);
        } else {
          saleTotalPaidWPaymentMethod = parseFloat(childData[pbTotalPaidWPaymentMethod]);
        }
        
        const saleGross = saleTotalPaidWPaymentMethod - saleTax + saleDiscountAmount;
        
        // If no transaction has been recorded for that date, record that date
        if (!pbData.hasOwnProperty(saleDate)) {
          pbData[saleDate] = {};
          pbData[saleDate]['Date'] = saleDate;
        }
        
        /**
         * If setting separateByPaymentMethod is enabled:
         */
        if ($scope.analyzePBDataSettingsPersist.separateByPaymentMethod) {
          // Separate by payment method
          if ($scope.analyzePBDataSettingsPersist.separateByLocation) {
            // Separate by location
            if (salePaymentMethod == 'Cash') {
              // Cash Sales
              
              /**
               * If a 'Cash Sales' object does not exist in the current date of
               * sales, create it.
               */
              if (
                typeof pbData[saleDate][outCashSales] == 'undefined'
                || (Object.keys(pbData[saleDate][outCashSales]).length === 0 && pbData[saleDate][outCashSales].constructor === Object)
              ) {
                pbData[saleDate][outCashSales] = {};
              }
              
              /**
               * If a location subobject does not exist in the current object,
               * create it.
               */
              if (
                typeof pbData[saleDate][outCashSales][saleLocation] == 'undefined'
                || (Object.keys(pbData[saleDate][outCashSales][saleLocation]).length === 0 && pbData[saleDate][outCashSales][saleLocation].constructor === Object)
              ) {
                 pbData[saleDate][outCashSales][saleLocation] = {};
                 pbData[saleDate][outCashSales][saleLocation]['Location'] = saleLocation;
              }
              
              let isLateFee = false;
              let isProduct = false;
              let isFoodProduct = false;
              let isGiftCard = false;
              
              if (new RegExp(lateFeeList.join("|")).test(childData[pbItemName].toLowerCase())) isLateFee = true;
              else if (new RegExp(giftCardsList.join("|")).test(childData[pbItemName].toLowerCase())) isGiftCard = true;
              else if (inventoryData.includes(childData[pbItemName])) isProduct = true;
              else if (new RegExp(foodProductsList.join("|")).test(childData[pbItemName].toLowerCase())) isFoodProduct = true;
              
              // If tax hasn't been recorded yet, make new property for tax
              if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outTax)) pbData[saleDate][outCashSales][saleLocation][outTax] = 0.0;
              pbData[saleDate][outCashSales][saleLocation][outTax] += saleTax.round(2);
              
              // If total hasn't been recorded yet, make new property for total
              if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outTotal)) pbData[saleDate][outCashSales][saleLocation][outTotal] = 0.0;
              pbData[saleDate][outCashSales][saleLocation][outTotal] += saleTotalPaidWPaymentMethod;
              
              if (isProduct) {
                if (saleGross != 0) {
                  // If product hasn't been recorded yet, record new product
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outProduct)) {
                    pbData[saleDate][outCashSales][saleLocation][outProduct] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outProduct] += saleGross;
                }
                
                if (childData[pbDiscountAmount] != 0) {
                  // If product discount hasn't been recorded yet, record new product discount
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outProductDiscount)) {
                    pbData[saleDate][outCashSales][saleLocation][outProductDiscount] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outProductDiscount] -= saleDiscountAmount;
                }
              } else if (isFoodProduct) {
                if (saleGross != 0) {
                  // If food product hasn't been recorded yet, record new food product
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outFoodProduct)) {
                    pbData[saleDate][outCashSales][saleLocation][outFoodProduct] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outFoodProduct] += saleGross;
                }
                
                // if (inventoryData.includes(childData[pbItemName])) {
                //   // If food product tax hasn't been recorded yet, record new food product tax
                //   if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outFoodProductTax)) {
                //     pbData[saleDate][outCashSales][saleLocation][outFoodProductTax] = 0.0;
                //   }
                //   pbData[saleDate][outCashSales][saleLocation][outFoodProductTax] += saleTax;
                // }
              } else if (isLateFee) {
                if (saleGross != 0) {
                  // If late fee hasn't been recorded yet, record new late fee
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outLateFee)) {
                    pbData[saleDate][outCashSales][saleLocation][outLateFee] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outLateFee] += saleGross;
                }
              } else if (isGiftCard) {
                if (saleGross != 0) {
                  // If product hasn't been recorded yet, record new product
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outGiftCard)) {
                    pbData[saleDate][outCashSales][saleLocation][outGiftCard] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outGiftCard] += saleGross;
                }
              } else {
                // Class sales
                if (saleGross != 0) {
                  // If class hasn't been recorded yet, record new class
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outClass)) {
                    pbData[saleDate][outCashSales][saleLocation][outClass] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outClass] += saleGross;
                }
                
                if (childData[pbDiscountAmount] != 0) {
                  // If class discount hasn't been recorded yet, record new class discount
                  if (!pbData[saleDate][outCashSales][saleLocation].hasOwnProperty(outClassDiscount)) {
                    pbData[saleDate][outCashSales][saleLocation][outClassDiscount] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][saleLocation][outClassDiscount] -= saleDiscountAmount;
                }
              }
            } else {
              // Credit Sales
              
              /**
               * If a 'Credit Sales' object does not exist in the current date of
               * sales, create it.
               */
              if (
                typeof pbData[saleDate][outCreditSales] == 'undefined'
                || (Object.keys(pbData[saleDate][outCreditSales]).length === 0 && pbData[saleDate][outCreditSales].constructor === Object)
              ) {
                pbData[saleDate][outCreditSales] = {};
              }
              
              /**
               * If a location subobject does not exist in the current object,
               * create it.
               */
              if (
                typeof pbData[saleDate][outCreditSales][saleLocation] == 'undefined'
                || (Object.keys(pbData[saleDate][outCreditSales][saleLocation]).length === 0 && pbData[saleDate][outCreditSales][saleLocation].constructor === Object)
              ) {
                 pbData[saleDate][outCreditSales][saleLocation] = {};
                 pbData[saleDate][outCreditSales][saleLocation]['Location'] = saleLocation;
              }
              
              let isNoAuth = false;
              let isLateFee = false;
              let isProduct = false;
              let isFoodProduct = false;
              let isGiftCard = false;
              
              // If payment method includes "no auth" create a separate entry on that date for no auth
              if (new RegExp('no auth').test(salePaymentMethod.toLowerCase())) {
                isNoAuth = true;
                pbData[saleDate][outCreditSales][saleLocation][outNoAuth] += saleTotalPaidWPaymentMethod;
              } else {
                if (new RegExp(lateFeeList.join("|")).test(childData[pbItemName].toLowerCase())) isLateFee = true;
                else if (new RegExp(giftCardsList.join("|")).test(childData[pbItemName].toLowerCase())) isGiftCard = true;
                else if (inventoryData.includes(childData[pbItemName])) isProduct = true;
                else if (new RegExp(foodProductsList.join("|")).test(childData[pbItemName].toLowerCase())) isFoodProduct = true;
                
                // If tax hasn't been recorded yet, make new property for tax
                if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outTax)) pbData[saleDate][outCreditSales][saleLocation][outTax] = 0.0;
                pbData[saleDate][outCreditSales][saleLocation][outTax] += saleTax.round(2);
                
                // If total hasn't been recorded yet, make new property for total
                if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outTotal)) pbData[saleDate][outCreditSales][saleLocation][outTotal] = 0.0;
                pbData[saleDate][outCreditSales][saleLocation][outTotal] += saleTotalPaidWPaymentMethod;
                
                if (isProduct) {
                  if (saleGross != 0) {
                    // If product hasn't been recorded yet, record new product
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outProduct)) {
                      pbData[saleDate][outCreditSales][saleLocation][outProduct] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outProduct] += saleGross;
                  }
                  
                  if (childData[pbDiscountAmount] != 0) {
                    // If product discount hasn't been recorded yet, record new product discount
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outProductDiscount)) {
                      pbData[saleDate][outCreditSales][saleLocation][outProductDiscount] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outProductDiscount] -= saleDiscountAmount;
                  }
                } else if (isFoodProduct) {
                  if (saleGross != 0) {
                    // If food product hasn't been recorded yet, record new food product
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outFoodProduct)) {
                      pbData[saleDate][outCreditSales][saleLocation][outFoodProduct] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outFoodProduct] += saleGross;
                  }
                  
                  // if (inventoryData.includes(childData[pbItemName])) {
                  //   // If food product tax hasn't been recorded yet, record new food product tax
                  //   if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outFoodProductTax)) {
                  //     pbData[saleDate][outCreditSales][saleLocation][outFoodProductTax] = 0.0;
                  //   }
                  //   pbData[saleDate][outCreditSales][saleLocation][outFoodProductTax] += saleTax;
                  // }
                } else if (isLateFee) {
                  if (saleGross != 0) {
                    // If late fee hasn't been recorded yet, record new late fee
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outLateFee)) {
                      pbData[saleDate][outCreditSales][saleLocation][outLateFee] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outLateFee] += saleGross;
                  }
                } else if (isGiftCard) {
                  if (saleGross != 0) {
                    // If product hasn't been recorded yet, record new product
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outGiftCard)) {
                      pbData[saleDate][outCreditSales][saleLocation][outGiftCard] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outGiftCard] += saleGross;
                  }
                } else {
                  // Class sales
                  if (saleGross != 0) {
                    // If class hasn't been recorded yet, record new class
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outClass)) {
                      pbData[saleDate][outCreditSales][saleLocation][outClass] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outClass] += saleGross;
                  }
                  
                  if (childData[pbDiscountAmount] != 0) {
                    // If class discount hasn't been recorded yet, record new class discount
                    if (!pbData[saleDate][outCreditSales][saleLocation].hasOwnProperty(outClassDiscount)) {
                      pbData[saleDate][outCreditSales][saleLocation][outClassDiscount] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][saleLocation][outClassDiscount] -= saleDiscountAmount;
                  }
                }
              }
            }
          } else {
            // Don't separate by location
            if (salePaymentMethod == 'Cash') {
              // Cash Sales
              
              /**
               * If a 'Cash Sales' object does not exist in the current date of
               * sales, create it.
               */
              if (
                typeof pbData[saleDate][outCashSales] == 'undefined'
                || (Object.keys(pbData[saleDate][outCashSales]).length === 0 && pbData[saleDate][outCashSales].constructor === Object)
              ) {
                pbData[saleDate][outCashSales] = {};
              }
              
              let isLateFee = false;
              let isProduct = false;
              let isFoodProduct = false;
              let isGiftCard = false;
              
              if (new RegExp(lateFeeList.join("|")).test(childData[pbItemName].toLowerCase())) isLateFee = true;
              else if (new RegExp(giftCardsList.join("|")).test(childData[pbItemName].toLowerCase())) isGiftCard = true;
              else if (inventoryData.includes(childData[pbItemName])) isProduct = true;
              else if (new RegExp(foodProductsList.join("|")).test(childData[pbItemName].toLowerCase())) isFoodProduct = true;
              
              // If tax hasn't been recorded yet, make new property for tax
              if (!pbData[saleDate][outCashSales].hasOwnProperty(outTax)) pbData[saleDate][outCashSales][outTax] = 0.0;
              pbData[saleDate][outCashSales][outTax] += saleTax;
              
              // If total hasn't been recorded yet, make new property for total
              if (!pbData[saleDate][outCashSales].hasOwnProperty(outTotal)) pbData[saleDate][outCashSales][outTotal] = 0.0;
              pbData[saleDate][outCashSales][outTotal] += saleTotalPaidWPaymentMethod;
              
              if (isProduct) {
                if (saleGross != 0) {
                  // If product hasn't been recorded yet, record new product
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outProduct)) {
                    pbData[saleDate][outCashSales][outProduct] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outProduct] += saleGross;
                }
                
                if (childData[pbDiscountAmount] != 0) {
                  // If product discount hasn't been recorded yet, record new product discount
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outProductDiscount)) {
                    pbData[saleDate][outCashSales][outProductDiscount] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outProductDiscount] -= saleDiscountAmount;
                }
              } else if (isFoodProduct) {
                if (saleGross != 0) {
                  // If food product hasn't been recorded yet, record new food product
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outFoodProduct)) {
                    pbData[saleDate][outCashSales][outFoodProduct] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outFoodProduct] += saleGross;
                }
                
                // if (inventoryData.includes(childData[pbItemName])) {
                //   // If food product tax hasn't been recorded yet, record new food product tax
                //   if (!pbData[saleDate][outCashSales].hasOwnProperty(outFoodProductTax)) {
                //     pbData[saleDate][outCashSales][outFoodProductTax] = 0.0;
                //   }
                //   pbData[saleDate][outCashSales][outFoodProductTax] += saleTax;
                // }
              } else if (isLateFee) {
                if (saleGross != 0) {
                  // If late fee hasn't been recorded yet, record new late fee
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outLateFee)) {
                    pbData[saleDate][outCashSales][outLateFee] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outLateFee] += saleGross;
                }
              } else if (isGiftCard) {
                if (saleGross != 0) {
                  // If product hasn't been recorded yet, record new product
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outGiftCard)) {
                    pbData[saleDate][outCashSales][outGiftCard] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outGiftCard] += saleGross;
                }
              } else {
                // Class sales
                if (saleGross != 0) {
                  // If class hasn't been recorded yet, record new class
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outClass)) {
                    pbData[saleDate][outCashSales][outClass] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outClass] += saleGross;
                }
                
                if (childData[pbDiscountAmount] != 0) {
                  // If class discount hasn't been recorded yet, record new class discount
                  if (!pbData[saleDate][outCashSales].hasOwnProperty(outClassDiscount)) {
                    pbData[saleDate][outCashSales][outClassDiscount] = 0.0;
                  }
                  
                  pbData[saleDate][outCashSales][outClassDiscount] -= saleDiscountAmount;
                }
              }
            } else {
              // Credit Sales
              
              /**
               * If a 'Credit Sales' object does not exist in the current date of
               * sales, create it.
               */
              if (
                typeof pbData[saleDate][outCreditSales] == 'undefined'
                || (Object.keys(pbData[saleDate][outCreditSales]).length === 0 && pbData[saleDate][outCreditSales].constructor === Object)
              ) {
                pbData[saleDate][outCreditSales] = {};
              }
              
              let isNoAuth = false;
              let isLateFee = false;
              let isProduct = false;
              let isFoodProduct = false;
              let isGiftCard = false;
              
              // If payment method includes "no auth" create a separate entry on that date for no auth
              if (new RegExp('no auth').test(salePaymentMethod.toLowerCase())) {
                isNoAuth = true;
                // pbData[saleDate][outCreditSales][saleLocation][outNoAuth] += saleTotalPaidWPaymentMethod;
              } else {
                
                if (new RegExp(lateFeeList.join("|")).test(childData[pbItemName].toLowerCase())) isLateFee = true;
                else if (new RegExp(giftCardsList.join("|")).test(childData[pbItemName].toLowerCase())) isGiftCard = true;
                else if (inventoryData.includes(childData[pbItemName])) isProduct = true;
                else if (new RegExp(foodProductsList.join("|")).test(childData[pbItemName].toLowerCase())) isFoodProduct = true;
                
                // If tax hasn't been recorded yet, make new property for tax
                if (!pbData[saleDate][outCreditSales].hasOwnProperty(outTax)) pbData[saleDate][outCreditSales][outTax] = 0.0;
                pbData[saleDate][outCreditSales][outTax] += saleTax;
                
                // If total hasn't been recorded yet, make new property for total
                if (!pbData[saleDate][outCreditSales].hasOwnProperty(outTotal)) pbData[saleDate][outCreditSales][outTotal] = 0.0;
                pbData[saleDate][outCreditSales][outTotal] += saleTotalPaidWPaymentMethod;
                
                if (isProduct) {
                  if (saleGross != 0) {
                    // If product hasn't been recorded yet, record new product
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outProduct)) {
                      pbData[saleDate][outCreditSales][outProduct] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outProduct] += saleGross;
                  }
                  
                  if (childData[pbDiscountAmount] != 0) {
                    // If product discount hasn't been recorded yet, record new product discount
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outProductDiscount)) {
                      pbData[saleDate][outCreditSales][outProductDiscount] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outProductDiscount] -= saleDiscountAmount;
                  }
                } else if (isFoodProduct) {
                  if (saleGross != 0) {
                    // If food product hasn't been recorded yet, record new food product
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outFoodProduct)) {
                      pbData[saleDate][outCreditSales][outFoodProduct] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outFoodProduct] += saleGross;
                  }
                  
                  // if (inventoryData.includes(childData[pbItemName])) {
                  //   // If food product tax hasn't been recorded yet, record new food product tax
                  //   if (!pbData[saleDate][outCreditSales].hasOwnProperty(outFoodProductTax)) {
                  //     pbData[saleDate][outCreditSales][outFoodProductTax] = 0.0;
                  //   }
                  //   pbData[saleDate][outCreditSales][outFoodProductTax] += saleTax;
                  // }
                } else if (isLateFee) {
                  if (saleGross != 0) {
                    // If late fee hasn't been recorded yet, record new late fee
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outLateFee)) {
                      pbData[saleDate][outCreditSales][outLateFee] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outLateFee] += saleGross;
                  }
                } else if (isGiftCard) {
                  if (saleGross != 0) {
                    // If product hasn't been recorded yet, record new product
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outGiftCard)) {
                      pbData[saleDate][outCreditSales][outGiftCard] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outGiftCard] += saleGross;
                  }
                } else {
                  // Class sales
                  if (saleGross != 0) {
                    // If class hasn't been recorded yet, record new class
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outClass)) {
                      pbData[saleDate][outCreditSales][outClass] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outClass] += saleGross;
                  }
                  
                  if (childData[pbDiscountAmount] != 0) {
                    // If class discount hasn't been recorded yet, record new class discount
                    if (!pbData[saleDate][outCreditSales].hasOwnProperty(outClassDiscount)) {
                      pbData[saleDate][outCreditSales][outClassDiscount] = 0.0;
                    }
                    
                    pbData[saleDate][outCreditSales][outClassDiscount] -= saleDiscountAmount;
                  }
                }
              }
              
            }
          }
        } else {
          // Don't separate by payment method
          if ($scope.analyzePBDataSettingsPersist.separateByLocation) {
            // Separate by location
          } else {
            // Don't separate by location
          }
        }
      });
    });
    
    $scope.pbData = pbData;
  };
}]);
