// Copyright (c) 2022 Siemens

/**
 * This service provides angular idle check to delay some critical watcher which impacts the performance
 *
 * @module js/xrtObjectSetAutoResizeService
 */
import awIdleWatcherService from 'js/awIdleWatcherService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Starts the resize watcher for the objectset
 * @param {Object} objectSetScope The scope of the objectSet
 */
export let startResizeWatcher = function( objectSetScope ) {
    awIdleWatcherService.waitForPageToLoad().then( function() {
        var resizeCheckDebounce = _.debounce( function() {
            eventBus.publish( objectSetScope.objsetdata.id + '.resizeCheck' );
        }, 300 );

        objectSetScope.$watch( function() {
            if( awIdleWatcherService.isRunning() === false ) {
                resizeCheckDebounce();
            }
        } );

        objectSetScope.$on( '$destroy', function() {
            resizeCheckDebounce.cancel();
        } );
    } );
};

export let moduleServiceNameToInject = 'xrtObjectSetAutoResizeService';
export default exports = {
    startResizeWatcher,
    moduleServiceNameToInject
};
