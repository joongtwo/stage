// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/PlanNavigationTimelineSync
 */
import '@swf/dhtmlxgantt/skins/dhtmlxgantt_meadow.css';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import planNavTreeUtils from 'js/PlanNavigationTreeUtils';
import planNavScrollService from 'js/PlanNavigationTreeScrollService';
import timelineDataSource from 'js/TimelineDataSourceService';
import timelineEventHandler from 'js/Timeline/uiTimelineEventHandler';
import timelineOverrides from 'js/Timeline/uiTimelineOverrides';
import timelineManager from 'js/uiGanttManager';
import timelineTemplates from 'js/Timeline/uiTimelineTemplates';
import timelineUtils from 'js/TimelineUtils';
import uiTimelineUtils from 'js/Timeline/uiTimelineUtils';

var exports = {};

export let initTimelineWidget = function( ) {
    var timelineElements = document.getElementsByClassName( 'prgTimeline' );
    timelineManager.getGanttInstance().plugins( {
        critical_path: true,
        tooltip: true,
        marker: true
    } );
    initializeConfigurations();
    timelineManager.getGanttInstance().init( timelineElements[0] );
    timelineOverrides.addOverrides( timelineDataSource );
    timelineTemplates.addTemplates();
    timelineEventHandler.setPlanNavTreeUtils(planNavTreeUtils);
    timelineEventHandler.setPlanNavTreeScrollService(planNavScrollService);
    timelineEventHandler.addDefaultEvents( timelineDataSource );
    timelineEventHandler.registerAWEvents( timelineDataSource );

    //display event properties if showEventProperties true in case of timeline toggle, should be called only after all the events are rendered on screen
    eventBus.publish( 'showEventProperties' );
};

//sets the initial configurations correctly
let initializeConfigurations = function() {
    timelineManager.getGanttInstance().templates.task_text = function( start, end, task ) {
        return '';
    };
    //This will display the name of event in timeline but it will be hidden by css file. This is done to validate the name of event from step def.
    timelineManager.getGanttInstance().templates.leftside_text = function( start, end, task ) {
        return task.text;
    };
    //following configurations should always be in the directive as they are needed to
    //set the initialization correctly.
    timelineManager.getGanttInstance().config.smart_rendering = false;
    timelineManager.getGanttInstance().config.multiselect = true;
    //sets the date format that is used to parse data from the data set.
    timelineManager.getGanttInstance().config.xml_date = '%Y-%m-%d %H:%i';
    timelineManager.getGanttInstance().config.grid_width = 200;
    timelineManager.getGanttInstance().keep_grid_width = true;
    timelineManager.getGanttInstance().config.work_time = true;
    timelineManager.getGanttInstance().config.correct_work_time = false;
    timelineManager.getGanttInstance().config.grid_resize = true;
    timelineManager.getGanttInstance().config.scale_height = 20 * 3;
    timelineManager.getGanttInstance().config.row_height = timelineUtils.getEventHeight() + 1;
    timelineManager.getGanttInstance().config.task_height_offset = timelineUtils.getEventHeightOffset();
    timelineManager.getGanttInstance().config.scale_unit = 'year';
    timelineManager.getGanttInstance().config.date_scale = '%Y';
    timelineManager.getGanttInstance().keyboard_navigation = true;
    timelineManager.getGanttInstance().keyboard_navigation_cells = true;
    timelineManager.getGanttInstance().config.show_grid = false;
    timelineManager.getGanttInstance().config.tooltip_hide_timeout = 1500;
};

export let clearAllTasks = function( ) {
    timelineManager.getGanttInstance().clearAll();
};

/**
 * Pushes the initial data loaded in tree table to the Timeline. This is done after
 * the Timeline is initialized and ready to parse the data to be displayed in Timeline.
 */
export let pushInitialDataToTimeline = function( eventData ) {
    if( appCtxSvc.ctx.showTimeline && !appCtxSvc.ctx.planNavigationCtx.isTimelineInitialized ) {
        // Set initialization flag to true, when timeline is turned on and timeline initialization is complete.
        appCtxSvc.updatePartialCtx( 'planNavigationCtx.isTimelineInitialized', true );

        let rootTreeNode = eventData.treeRootNoode;
        if( rootTreeNode ) {
            let timelineObjects = exports.addTreeNodesToTimeline( rootTreeNode );
            if( !_.isEmpty( timelineObjects ) ) {
                uiTimelineUtils.parseGanttData( timelineObjects );
                let eventData = {};
                eventBus.publish( 'reloadMilestonesOnTimeline', eventData );
            }
            //When timeline command button toggled ON/OFF we have to persist the state of "Dependency" button and show/hide the dependency link
            if ( timelineObjects && timelineObjects.length > 0 ) {
                let events = _.filter( timelineObjects, function( timelineObject ) { return timelineObject.programType && timelineObject.programType === 'Event'; } );
                if( appCtxSvc.ctx.showTimeline && appCtxSvc.ctx.planNavigationCtx.isTimelineInitialized &&
                    appCtxSvc.ctx.showHideEventDependencyFlag && events && events.length > 0 ) {
                        eventBus.publish( 'processedEventsInfo', events );
                }
            }
        }
    }
};

/**
 * Traverses the given parent node, finds the children recursively and adds
 * to the Timeline.
 * @param {Object} parentNode The parent to traverse and add children.
 * @returns {Array} The list of objects to be added on Timeline
 */
export let addTreeNodesToTimeline = ( parentNode ) => {
    let parentNodeList = [ parentNode ];
    let timelineObjects = getChildNodesForTimeline( parentNodeList );
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }
    if( childNodes ) {
        childNodes.forEach( ( node ) => {
            let newObjects = addTreeNodesToTimeline( node );
            timelineObjects = _.concat( timelineObjects, newObjects );
        } );
    }
    return timelineObjects;
};

/**
 * Adds plan and event objects to timeline.
 * @param {Array} planObjects list of plan objects
 */
export let addChildNodesToTimelines = function( planObjects ) {
    let timelineObjects = getChildNodesForTimeline( planObjects );
    if( !_.isEmpty( timelineObjects ) ) {
        uiTimelineUtils.parseGanttData( timelineObjects );
    }
};

/**
 * Returns plan and events to be added to timeline
 * @param {Array} planObjects list of plan objects
 * @returns {Array} List of plan and event objects
 */
export let getChildNodesForTimeline = function( planObjects ) {
    let timelinePlans = [];
    let eventObjects = [];
    let rootEle = planObjects[0];
    planObjects.forEach( ( planObj ) => {
        if( !timelineManager.getGanttInstance().isTaskExists( planObj.uid ) ) {
            let planObject = cdm.getObject( planObj.uid );
            let planInfo = timelineDataSource.addPlan( planObject, rootEle );
            if( planObjects.isExpanded === true ) {
                planInfo.$open = true;
            }
            timelinePlans.push( planInfo );
            if( !_.isEmpty( planObj.events ) ) {
                planObj.events.forEach( ( event ) => {
                    eventObjects.push( event );
                } );
            }
        }
    } );
    let timelineEvents = exports.getEventsForTimeline( eventObjects );
    timelinePlans = _.concat( timelinePlans, timelineEvents );
    return timelinePlans;
};

/**
 * Adds the event objects to timeline
 * @param {Array} events The list of event objects
 * @returns {Array} List of Event objects
 */
export let getEventsForTimeline = function( events ) {
    let timelineEvents = [];
    events.forEach( ( event ) => {
        let eventInfo = timelineDataSource.addEvent( event );
        timelineEvents.push( eventInfo );
    } );
    return timelineEvents;
};

/**
 * Selects Event object in timeline
 * @param {String} eventId The uid of Event object to be selected
 */
export let selectEventOnTimeline = function( eventId ) {
    let selectedId = timelineManager.getGanttInstance().getSelectedId();
    let parentPlanUid = timelineManager.getGanttInstance().getParent( selectedId );

    let timelineObject = cdm.getObject( eventId );
    if( timelineObject && timelineObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        eventId += '__' + parentPlanUid;
    }
    if( timelineManager.getGanttInstance().isTaskExists( eventId ) ) {
        timelineManager.getGanttInstance().selectTask( eventId );
    }
};

/**
 * Selects Event object in timeline
 * @param {String} eventId The uid of Event object to be selected
 */
export let reorderPlanOnTimeline = function( planUid, index, parentUid ) {
    if( timelineManager.getGanttInstance().isTaskExists( planUid ) ) {
        timelineManager.getGanttInstance().moveTask( planUid, index, parentUid );
    }
};

/**
 * Adds event objects to Timeline
 * @param {Array} eventObjs The list of event objects
 * @param {Object} data ViewModel object
 */
export let addEventObjectsInTimeline = function( eventObjs, data ) {
    let ganttEventArray = [];
    eventObjs.forEach( ( event ) => {
        let eventObject = timelineDataSource.addEvent( event );
        eventObject.rollup = true;
        ganttEventArray.push( eventObject );
    } );
    uiTimelineUtils.parseGanttData( ganttEventArray );
    if( data ) {
        uiTimelineUtils.setInputParamForEventPosition( ganttEventArray, data );
    }
};

export let updateTimelineSelectionForParent = ( selectedEvent, timelineSelection ) => {
    const newSelectionData = { ...timelineSelection.value };
    newSelectionData.selected = [ selectedEvent ];
    timelineSelection.update( newSelectionData );
};

export default exports = {
    initTimelineWidget,
    clearAllTasks,
    addTreeNodesToTimeline,
    getChildNodesForTimeline,
    addChildNodesToTimelines,
    getEventsForTimeline,
    pushInitialDataToTimeline,
    selectEventOnTimeline,
    reorderPlanOnTimeline,
    addEventObjectsInTimeline,
    updateTimelineSelectionForParent
};

