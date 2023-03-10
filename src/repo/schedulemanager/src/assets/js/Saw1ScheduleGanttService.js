// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awGanttConfigService from 'js/AwGanttConfigurationService';
import eventBus from 'js/eventBus';
import ganttCallbacks, { Saw1ScheduleGanttCallbacks } from 'js/Saw1ScheduleGanttCallbacks';
import ganttScrollService from 'js/Saw1ScheduleGanttScrollService';
import Saw1ScheduleGanttDataService from 'js/Saw1ScheduleGanttDataService';

/**
 * Initializes the required properties for the Gantt to be loaded.
 * @param {Object} schedule The owning schedule for which the Gantt chart will be rendered
 * @param {Object} atomicDataRef Atomic data
 */
export const initializeGanttChartState = ( schedule, atomicDataRef ) => {
    console.log( 'Saw1ScheduleGanttService initializeGanttChartState' );

    let zoomLevel = appCtxSvc.getCtx( 'preferences.AWC_SM_Gantt_Zoom_Level' );

    atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        zoomLevel: getValidZoomLevel( zoomLevel ? zoomLevel[ 0 ] : 'unit_of_time_measure', schedule ),
        ganttConfig: getScheduleGanttConfig( new Date( schedule.props.start_date.dbValues[ 0 ] ), new Date( schedule.props.finish_date.dbValues[ 0 ] ) ),
        callbacks: new Saw1ScheduleGanttCallbacks()
    } );

    return {
        isGanttChartStateInited: true,
        ganttDataService: new Saw1ScheduleGanttDataService()
    };
};

/**
 * @returns flag indicating the schedule summary properties are loaded.
 */
export const setScheduleSummaryPropLoaded = () => {
    return { isScheduleSummaryPropLoaded: true };
};

/**
 * Initialize the basic gantt config properties for loading the gantt chart.
 * @param {Date} startDate The start date of the gantt chart.
 * @param {Date} endDate The finish date of the gantt chart.
 * @returns {Object} The gantt properties
 */
const getScheduleGanttConfig = ( startDate, endDate ) => {
    let ganttConfig = awGanttConfigService.getDefaultConfiguration();
    ganttConfig.scale_height = 72; // XLARGE
    ganttConfig.bar_height = 'full';
    ganttConfig.drag_links = true;
    ganttConfig.drag_move = true;
    ganttConfig.drag_progress = true;
    ganttConfig.drag_resize = true;
    ganttConfig.link_wrapper_width = 20;
    ganttConfig.order_branch = true;
    ganttConfig.order_branch_free = true;
    ganttConfig.readonly = false;
    ganttConfig.show_grid = false;
    ganttConfig.columns = [ { name: 'text', label: 'Task name', tree: true, width: '150' } ]; // FIX ME: Remove it during final implementation.
    ganttConfig.show_tasks_outside_timescale = true;
    ganttConfig.start_date = startDate;
    ganttConfig.start_date.setDate( ganttConfig.start_date.getDate() - 21 ); // Move the start date a bit earlier so that it is not partially visible
    ganttConfig.end_date = endDate;
    ganttConfig.links = { ...ganttConfig.links, finish_to_start: '0', finish_to_finish: '1', start_to_start: '2', start_to_finish: '3' };
    ganttConfig.types = { ...ganttConfig.types, standard: '0', milestone: '1', summary: '2', phase: '3', gate: '4', link: '5', scheduleSummary: '6' };
    return ganttConfig;
};

/**
 * Returns the work times as per the Gatt chart expected format, built
 * using the input calendar information.
 * @param {Object} calendarInfo The calendar information.
 * @returns {Array} Array of work times
 */
const getWorkTimes = ( calendarInfo ) => {
    let workTimes = [];
    if( calendarInfo && calendarInfo.dayRanges ) {
        workTimes = Object.values( calendarInfo.dayRanges ).reduce( ( workTimes, dayRange, index ) => {
            workTimes.push( { day: index, hours: dayRange ? dayRange : false } );
            return workTimes;
        }, workTimes );
    }

    if( calendarInfo && calendarInfo.eventRanges ) {
        workTimes = calendarInfo.eventRanges.reduce( ( workTimes, eventRange ) => {
            workTimes.push( { date: new Date( eventRange.eventDate ), hours: eventRange.ranges ? eventRange.ranges : false } );
            return workTimes;
        }, workTimes );
    }
    return workTimes;
};

export const subscribeEvents = ( ganttDataService, atomicDataRef ) => {
    const getGanttInstance = ( atomicDataRef ) => atomicDataRef.ganttChartState.getAtomicData().ganttInstance;

    let eventSubscriptions = [];
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTreeDataProvider.treeNodesLoaded', ( eventData ) => ganttCallbacks.onTreeNodesLoaded( eventData, ganttDataService,
        atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesLoaded', ( eventData ) => ganttCallbacks.onDependenciesLoaded( eventData, ganttDataService, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.plTable.toggleTreeNode', ( node ) => ganttCallbacks.onToggleTreeNode( node, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.collapseBelow', ( eventData ) => ganttCallbacks.onCollapseBelow( eventData, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesAdded', ( eventData ) => ganttCallbacks.onNodesAdded( eventData, ganttDataService, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesRemoved', ( eventData ) => ganttCallbacks.onNodesRemoved( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.tasksReordered', ( eventData ) => ganttCallbacks.onTasksReordered( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesAdded', ( eventData ) => ganttCallbacks.onDependenciesAdded( eventData, ganttDataService, getGanttInstance(
        atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesDeleted', ( eventData ) => ganttCallbacks.onDependenciesDeleted( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'cdm.updated', ( eventData ) => ganttCallbacks.onObjectsUpdated( eventData, ganttDataService, atomicDataRef ) ) );

    // Listen to Tree table scroll to sync up Gantt scroll
    ganttScrollService.registerTableGanttScrollSync();

    return { eventSubscriptions };
};

export const unsubscribeEvents = ( eventSubscriptions ) => {
    // Stop listening to Tree table scroll.
    ganttScrollService.unRegisterTableGanttScrollSync();

    eventSubscriptions.forEach( event => event && eventBus.unsubscribe( event ) );
    return { eventSubscriptions: [] };
};

export const renderProgramEventsOnGantt = ( schedule, atomicDataRef, eventData, ganttDataService ) => {
    let isProgramEventsDisplayed = appCtxSvc.getCtx( 'isSchedulePlanEventsShown' );
    appCtxSvc.updateCtx( 'isSchedulePlanEventsShown', !isProgramEventsDisplayed );
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let scheduleSummaryTask = ganttInstance.getTaskByIndex( 0 );
    for( let idx = 0; idx < eventData.addedNodes.length; idx++ ) {
        ganttInstance.addTask( ganttDataService.constructGanttObject( eventData.addedNodes[ idx ] ), scheduleSummaryTask.id );
    }
    let addedEvents = eventData.addedNodes;
    return { addedEvents: addedEvents };
};

export const removeAddedEventsonGantt= ( schedule, atomicDataRef, eventData ) => {
    let isProgramEventsDisplayed = appCtxSvc.getCtx( 'isSchedulePlanEventsShown' );
    appCtxSvc.updateCtx( 'isSchedulePlanEventsShown', !isProgramEventsDisplayed );
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let scheduleSummaryTask = ganttInstance.getTaskByIndex( 0 );
    for( let idx = 0; idx < eventData.length; idx++ ) {
        ganttInstance.deleteTask( eventData[ idx ].uid );
    }
};


export const processCriticalPathOutput = ( soaResponse, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;

    if( ganttInstance && soaResponse.tasks && Array.isArray( soaResponse.tasks ) ) {
        ganttInstance[ 'criticalTaskUids' ] = {};
        soaResponse.tasks.forEach( tcTask => ganttInstance.criticalTaskUids[ tcTask.uid ] = true );
    }
    ganttInstance.refreshData();
};

export const clearCriticalPath = ( atomicDataRef ) => {
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance[ 'criticalTaskUids' ] = {};
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.refreshData();
};

const getValidZoomLevel = ( zoomLevel, schedule ) => {
    // Map of UnitofTimeMeasure LOV values to Gantt zoom level names.
    const uotmZoomLevelMap = { h: 'day', d: 'day', w: 'week', mo: 'month' };
    if( zoomLevel === 'unit_of_time_measure' ) {
        zoomLevel = uotmZoomLevelMap[ _.get( schedule, 'props.saw1UnitOfTimeMeasure.dbValues[0]', 'd' ) ];
    }
    return zoomLevel;
};

export const setZoomLevel = ( zoomLevel, atomicDataRef, schedule ) => {
    let newZoomLevel = getValidZoomLevel( zoomLevel, schedule );
    if( atomicDataRef.ganttChartState.getAtomicData().zoomLevel !== newZoomLevel ) {
        atomicDataRef.ganttChartState.setAtomicData( { ...atomicDataRef.ganttChartState.getAtomicData(), zoomLevel: newZoomLevel } );
    }
};

export const updateZoomLevelPref = ( prefValue, schedule, newZoomLevel ) => {
    let prefZoomLevel = getValidZoomLevel( prefValue, schedule );
    if( prefZoomLevel !== newZoomLevel ) {
        appCtxSvc.updatePartialCtx( 'preferences.AWC_SM_Gantt_Zoom_Level', [ newZoomLevel ] );
    }
};

export const showHideTaskInfo = ( atomicDataRef, showOrHideInfo ) => {
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance[ 'showGanttTaskInfo' ] = showOrHideInfo;
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.refreshData();
};

export const updateWorkTimes = ( atomicDataRef, calendarInfo ) => {
    calendarInfo && atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        workTimes: getWorkTimes( calendarInfo )
    } );
};
