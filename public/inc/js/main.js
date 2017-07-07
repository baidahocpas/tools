/*global angular*/
/*jslint node:true*/
'use strict';

angular
.module('baidahocpasToolsApp', [
  'firebase',
  'ui.router',
])
.config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider
  .state('admin', {
    url: '/admin',
    views: {
      '': {
        templateUrl: 'pg/views/admin/index.html',
        controller: 'adminCtrl',
      },
      'footer@admin': {
        templateUrl: 'pg/templates/footer.html',
        controller: 'adminCtrl',
      },
      'header@admin': {
        templateUrl: 'pg/views/admin/header.html',
        controller: 'adminCtrl',
      },
      'importantDates@admin': {
        templateUrl: 'pg/views/admin/importantDates.html',
        controller: 'adminCtrl',
      },
      'navbar@admin': {
        templateUrl: 'pg/templates/navbar.html',
        controller: 'adminCtrl',
      },
    },
    resolve: {
      auth: function ($state, Auth) {
        return Auth.$requireSignIn().catch(function () {
          $state.go('login');
        });
      }
    },
  })
  .state('home', {
    url: '/',
    views: {
      '': {
        templateUrl: 'pg/views/home/index.html',
        controller: 'homeCtrl',
      },
      'contactBanner@home': {
        templateUrl: 'pg/templates/contactBanner.html',
        controller: 'homeCtrl',
      },
      'footer@home': {
        templateUrl: 'pg/templates/footer.html',
        controller: 'homeCtrl',
      },
      'header@home': {
        templateUrl: 'pg/views/home/header.html',
        controller: 'homeCtrl',
      },
      'navbar@home': {
        templateUrl: 'pg/templates/navbar.html',
        controller: 'homeCtrl',
      },
      'sidebar@home': {
        templateUrl: 'pg/views/home/sidebar.html',
        controller: 'homeCtrl',
      },
      'tabs@home': {
        templateUrl: 'pg/views/home/tabs.html',
        controller: 'homeCtrl',
      },
    },
    resolve: {
      auth: function ($state, Auth) {
        return Auth.$requireSignIn().catch(function () {
          $state.go('login');
        });
      }
    },
  })
  .state('login', {
    url: '/login',
    views: {
      '': {
        templateUrl: 'pg/views/login/index.html',
        controller: 'loginCtrl',
      },
      'footer@login': {
        templateUrl: 'pg/templates/footer.html',
        controller: 'loginCtrl',
      },
      'header@login': {
        templateUrl: 'pg/views/login/header.html',
        controller: 'loginCtrl',
      },
      'loginCard@login': {
        templateUrl: 'pg/views/login/loginCard.html',
        controller: 'loginCtrl',
      },
      'navbar@login': {
        templateUrl:  'pg/templates/navbar.html',
        controller: 'loginCtrl',
      },
    },
  })
  .state('purebarre', {
    url: '/purebarre',
    views: {
      '': {
        templateUrl: 'pg/views/purebarre/index.html',
        controller: 'purebarreCtrl',
      },
      'footer@purebarre': {
        templateUrl: 'pg/templates/footer.html',
        controller: 'purebarreCtrl',
      },
      'header@purebarre': {
        templateUrl: 'pg/views/purebarre/header.html',
        controller: 'purebarreCtrl',
      },
      'navbar@purebarre': {
        templateUrl:  'pg/templates/navbar.html',
        controller: 'purebarreCtrl',
      },
      'upload@purebarre': {
        templateUrl: 'pg/views/purebarre/upload.html',
        controller: 'purebarreCtrl',
      },
    },
    resolve: {
      auth: function ($state, Auth) {
        return Auth.$requireSignIn().catch(function () {
          $state.go('login');
        });
      }
    },
  })
  
  // For PureBarre studio upload settings
  .state('purebarre.settings', {
    // URL will be /purebarre/settings
    url: '/settings',
    views: {
      '': {
        templateUrl: 'pg/views/purebarre/settings/index.html',
        controller: 'purebarreSettingsCtrl',
      },
      'footer@purebarre': {
        templateUrl: 'pg/templates/footer.html',
        controller: 'purebarreSettingsCtrl',
      },
      'header@purebarre': {
        templateUrl: 'pg/views/purebarre/settings/header.html',
        controller: 'purebarreSettingsCtrl',
      },
      'navbar@purebarre': {
        templateUrl:  'pg/templates/navbar.html',
        controller: 'purebarreSettingsCtrl',
      },
      'upload@purebarre': {
        templateUrl: 'pg/views/purebarre/settings/upload.html',
        controller: 'purebarreSettingsCtrl',
      },
    },
    resolve: {
      auth: function ($state, Auth) {
        return Auth.$requireSignIn().catch(function () {
          $state.go('login');
        });
      }
    },
  });

  $urlRouterProvider.otherwise('/');
})
.run(function ($rootScope) {
  // On state change, scroll to top
  // http://stackoverflow.com/a/22420145/5623385
  $rootScope.$on('$stateChangeSuccess',function(){
    $("html, body").animate({ scrollTop: 0 }, 0);
  });
})
.run(['$rootScope', '$state', function ($rootScope, $state) {
  $rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, error) {
    if (error === 'AUTH_REQUIRED') {
      $state.go('home');
    }
  });
}])
.constant('NAV_LINKS', {
  internal: [
    {
      name: 'Home',
      sref: 'home',
    },
    {
      name: 'Competition',
      sref: 'competitiveEvents'
    },
    {
      name: 'Contact',
      sref: 'contact',
    },
  ],
  external: [
  ],
});
