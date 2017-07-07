/*global angular*/
/*jslint node:true*/
'use strict';

angular
.module('baidahocpasToolsApp')
.controller('loginCtrl', ['$scope', '$state', 'Auth', 'NAV_LINKS', function ($scope, $state, Auth, NAV_LINKS) {
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
        $state.go('home');
      }
    });
  };
  
  $scope.loading = false;
  
  if ($scope.user) {
    $state.go('home');
  }
  
  $scope.loginUser = {
    email: null,
    password: null,
  };
  
  $scope.signIn = function () {
    $scope.error = null;
    $scope.loading = true;
    
    Auth.$signInWithEmailAndPassword($scope.loginUser.email, $scope.loginUser.password)
    .then(function (firebaseUser) {
      console.log('Login success.');
      $state.go('home');
    }).catch(function (err) {
      $scope.error = 'Error signing in.';
      console.error('Auth failed: ', err);
      $scope.loginUser.password = null;
      $scope.loading = false;
    });
  };
}]);
