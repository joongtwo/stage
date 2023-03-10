// Copyright (c) 2022 Siemens

/**
 * @module js/PlanNavigationService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import eventBus from 'js/eventBus';
import planNavTreeSync from 'js/PlanNavigationTimelineSync';
import planNavTreeUtils from 'js/PlanNavigationTreeUtils';

let exports = {};

/**
 * Initializes the data for plan navigation sublocation
 * @param {Object} data view model data
 */
export let initializePlanNavigationSublocation = function( data ) {
    appCtxSvc.registerCtx( 'planNavigationCtx', {
        isTimelineInitialized: false
    } );
    let eventSubscriptions = [];
    subscribeToEvents( eventSubscriptions );
    appCtxSvc.registerCtx( 'timelineContext', [] );
    // For ProgramBoard
    appCtxSvc.registerCtx( 'isColumnFilteringApplied', false );

    let timelinePref = appCtxSvc.getCtx( 'preferences.AW_SubLocation_PlanNavigationSubLocation_ShowTimeline' );
    appCtxSvc.registerCtx( 'showTimeline', !( timelinePref && timelinePref[ 0 ] === 'false' ) );
    planNavTreeUtils.loadEventProperties();

    return {
        eventSubscriptions: eventSubscriptions,
        initSuccess: true
    };
};

/**
 * Subscribe to events for tree and timeline integration
 * @param {Object} data view model
 */
let subscribeToEvents = function( eventSubscriptions ) {
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTreeDataProvider.treeNodesLoaded', function( eventData ) {
        if( appCtxSvc.ctx.showTimeline && appCtxSvc.ctx.planNavigationCtx.isTimelineInitialized && !_.isEmpty( eventData.treeLoadResult ) ) {
            planNavTreeSync.addChildNodesToTimelines( eventData.treeLoadResult.childNodes );
        }
    } ) );

    eventSubscriptions.push( eventBus.subscribe( 'appCtx.update', ( event ) => {
        if( event.name === 'showTimeline' && event.value === false ) {
            appCtxSvc.updatePartialCtx( 'planNavigationCtx.isTimelineInitialized', false );
            planNavTreeSync.clearAllTasks();
        }
    } ) );

    // Once the Timeline is initialized, push the data from tree table to the chart.
    eventSubscriptions.push( eventBus.subscribe( 'PlanTimeline.timelineInitialized', planNavTreeSync.pushInitialDataToTimeline ) );

    eventSubscriptions.push( eventBus.subscribe( 'planNavigation.planReordered', function( eventData ) {
        if( eventData && eventData.timelineMovePlanContainer ) {
            let movePlanContainer = eventData.timelineMovePlanContainer;
            planNavTreeSync.reorderPlanOnTimeline( movePlanContainer.planUid, movePlanContainer.index, movePlanContainer.parentUid );
        }
    } ) );
};

/**
 * Cleanup data while destructing the plan navigation sublocation
 * @param {Object} data view model data
 */
export let destroyPlanNavigationSublocation = function( data ) {
    if( data.eventSubscriptions.length > 0 ) {
        for( var i = 0; i < data.eventSubscriptions.length; i++ ) {
            var event = data.eventSubscriptions[ i ];
            if( event ) {
                eventBus.unsubscribe( event );
            }
        }
        data.eventSubscriptions = [];
    }
    planNavTreeUtils.unloadEventProperties();
    // For ProgramBoard
    appCtxSvc.unRegisterCtx( 'isColumnFilteringApplied' );
};

export const updatePlanNavigationContextOnFilterChange = ( planNavigationContext ) => {
    var planNavigationContextValue = planNavigationContext.getValue();
    let columnFilteringApplied = planNavigationContextValue.columnFilters.length > 0;

    if( !planNavigationContextValue.isStructureEditSupported && columnFilteringApplied !== true && !AwStateService.instance.params.filter ) {
        planNavigationContextValue.isStructureEditSupported = true;
        planNavigationContext.update( planNavigationContextValue );
    } else if( planNavigationContextValue.isStructureEditSupported && ( columnFilteringApplied === true || AwStateService.instance.params.filter ) ) {
        planNavigationContextValue.isStructureEditSupported = false;
        planNavigationContext.update( planNavigationContextValue );
    }
};

/**
 * PlanNavigationService factory
 */
export default exports = {
    initializePlanNavigationSublocation,
    destroyPlanNavigationSublocation,
    updatePlanNavigationContextOnFilterChange
};
