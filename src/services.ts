/**
 * # Angular 1 types
 *
 * UI-Router core provides various Typescript types which you can use for code completion and validating parameter values, etc.
 * The customizations to the core types for Angular UI-Router are documented here.
 *
 * The optional [[$resolve]] service is also documented here.
 *
 * @preferred @publicapi @module ng1
 */ /** */
import { ng as angular } from './angular';
import {
  IRootScopeService,
  IQService,
  ILocationService,
  ILocationProvider,
  IHttpService,
  ITemplateCacheService,
} from 'angular';
import {
  services,
  applyPairs,
  isString,
  trace,
  extend,
  UIRouter,
  StateService,
  UrlRouter,
  UrlMatcherFactory,
  ResolveContext,
  unnestR,
  TypedMap,
} from '@uirouter/core';
import { ng1ViewsBuilder, getNg1ViewConfigFactory } from './statebuilders/views';
import { TemplateFactory } from './templateFactory';
import { StateProvider } from './stateProvider';
import { getStateHookBuilder } from './statebuilders/onEnterExitRetain';
import { Ng1LocationServices } from './locationServices';
import { UrlRouterProvider } from './urlRouterProvider';
import IInjectorService = angular.auto.IInjectorService; // tslint:disable-line

angular.module('ui.router.angular1', []);
const mod_init = angular.module('ui.router.init', ['ng']);
const mod_util = angular.module('ui.router.util', ['ui.router.init']);
const mod_rtr = angular.module('ui.router.router', ['ui.router.util']);
const mod_state = angular.module('ui.router.state', ['ui.router.router', 'ui.router.util', 'ui.router.angular1']);
const mod_main = angular.module('ui.router', ['ui.router.init', 'ui.router.state', 'ui.router.angular1']);
const mod_cmpt = angular.module('ui.router.compat', ['ui.router']); // tslint:disable-line

declare module '@uirouter/core/lib/router' {
  interface UIRouter {
    // tslint:disable-line:no-shadowed-variable
    /** @hidden */
    stateProvider: StateProvider;
    /** @hidden */
    urlRouterProvider: UrlRouterProvider;
  }
}

let router: UIRouter = null;

$uiRouterProvider.$inject = ['$locationProvider'];
/** This angular 1 provider instantiates a Router and exposes its services via the angular injector */
function $uiRouterProvider($locationProvider: ILocationProvider) {
  // Create a new instance of the Router when the $uiRouterProvider is initialized
  router = this.router = new UIRouter();
  router.stateProvider = new StateProvider(router.stateRegistry, router.stateService);

  // Apply ng1 specific StateBuilder code for `views`, `resolve`, and `onExit/Retain/Enter` properties
  router.stateRegistry.decorator('views', ng1ViewsBuilder);
  router.stateRegistry.decorator('onExit', getStateHookBuilder('onExit'));
  router.stateRegistry.decorator('onRetain', getStateHookBuilder('onRetain'));
  router.stateRegistry.decorator('onEnter', getStateHookBuilder('onEnter'));

  router.viewService._pluginapi._viewConfigFactory('ng1', getNg1ViewConfigFactory());

  const ng1LocationService = (router.locationService = router.locationConfig = new Ng1LocationServices(
    $locationProvider
  ));

  Ng1LocationServices.monkeyPatchPathParameterType(router);

  // backwards compat: also expose router instance as $uiRouterProvider.router
  router['router'] = router;
  router['$get'] = $get;
  $get.$inject = ['$location', '$browser', '$window', '$sniffer', '$rootScope', '$http', '$templateCache'];
  function $get(
    $location: ILocationService,
    $browser: any,
    $window: any,
    $sniffer: any,
    $rootScope: ng.IScope,
    $http: IHttpService,
    $templateCache: ITemplateCacheService
  ) {
    ng1LocationService._runtimeServices($rootScope, $location, $sniffer, $browser, $window);
    delete router['router'];
    delete router['$get'];
    return router;
  }
  return router;
}

const getProviderFor = serviceName => [
  '$uiRouterProvider',
  $urp => {
    const service = $urp.router[serviceName];
    service['$get'] = () => service;
    return service;
  },
];

// This effectively calls $get() on `$uiRouterProvider` to trigger init (when ng enters runtime)
runBlock.$inject = ['$injector', '$q', '$uiRouter'];
function runBlock($injector: IInjectorService, $q: IQService, $uiRouter: UIRouter) {
  services.$injector = $injector;
  services.$q = <any>$q;

  // https://github.com/angular-ui/ui-router/issues/3678
  if (!$injector.hasOwnProperty('strictDi')) {
    try {
      $injector.invoke(function(checkStrictDi) {});
    } catch (error) {
      $injector.strictDi = !!/strict mode/.exec(error && error.toString());
    }
  }

  // The $injector is now available.
  // Find any resolvables that had dependency annotation deferred
  $uiRouter.stateRegistry
    .get()
    .map(x => x.$$state().resolvables)
    .reduce(unnestR, [])
    .filter(x => x.deps === 'deferred')
    .forEach(resolvable => (resolvable.deps = $injector.annotate(resolvable.resolveFn, $injector.strictDi)));
}

// $urlRouter service and $urlRouterProvider
const getUrlRouterProvider = (uiRouter: UIRouter) => (uiRouter.urlRouterProvider = new UrlRouterProvider(uiRouter));

// $state service and $stateProvider
// $urlRouter service and $urlRouterProvider
const getStateProvider = () => extend(router.stateProvider, { $get: () => router.stateService });

watchDigests.$inject = ['$rootScope'];
export function watchDigests($rootScope: IRootScopeService) {
  $rootScope.$watch(function() {
    trace.approximateDigests++;
  });
}

mod_init.provider('$uiRouter', <any>$uiRouterProvider);
mod_rtr.provider('$urlRouter', ['$uiRouterProvider', getUrlRouterProvider]);
mod_util.provider('$urlService', getProviderFor('urlService'));
mod_util.provider('$urlMatcherFactory', ['$uiRouterProvider', () => router.urlMatcherFactory]);
mod_util.provider('$templateFactory', () => new TemplateFactory());
mod_state.provider('$stateRegistry', getProviderFor('stateRegistry'));
mod_state.provider('$uiRouterGlobals', getProviderFor('globals'));
mod_state.provider('$transitions', getProviderFor('transitionService'));
mod_state.provider('$state', ['$uiRouterProvider', getStateProvider]);

mod_state.factory('$stateParams', ['$uiRouter', ($uiRouter: UIRouter) => $uiRouter.globals.params]);
mod_main.factory('$view', () => router.viewService);
mod_main.service('$trace', () => trace);

mod_main.run(watchDigests);
mod_util.run(['$urlMatcherFactory', function($urlMatcherFactory: UrlMatcherFactory) {}]);
mod_state.run(['$state', function($state: StateService) {}]);
mod_rtr.run(['$urlRouter', function($urlRouter: UrlRouter) {}]);
mod_init.run(runBlock);

/** @hidden TODO: find a place to move this */
export const getLocals = (ctx: ResolveContext): TypedMap<any> => {
  const tokens = ctx.getTokens().filter(isString);

  const tuples = tokens.map(key => {
    const resolvable = ctx.getResolvable(key);
    const waitPolicy = ctx.getPolicy(resolvable).async;
    return [key, waitPolicy === 'NOWAIT' ? resolvable.promise : resolvable.data];
  });

  return tuples.reduce(applyPairs, {});
};
