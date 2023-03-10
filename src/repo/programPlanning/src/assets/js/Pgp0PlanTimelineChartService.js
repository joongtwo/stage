// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awGanttConfigService from 'js/AwGanttConfigurationService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeService from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import Pgp0PlanTimelineDataService from 'js/Pgp0PlanTimelineDataService';
import timelineScrollService from 'js/PlanNavigationTreeScrollService';
import timelineCallbacks, { Pgp0PlanTimelineCallbacks } from 'js/Pgp0PlanTimelineCallbacks';

/**
 * Initializes the required properties for the Timeline to be loaded.
 * @param {Object} schedule The owning schedule for which the Timeline chart will be rendered
 * @param {Object} calendarInfo The calender information to be used for the Timeline chart
 * @param {Object} atomicDataRef Atomic data
 */
export const initializeTimelineChartState = ( planObj, atomicDataRef ) => {
    let zoomLevel = appCtxSvc.getCtx( 'preferences.AWC_Timeline_Zoom_Level' );
    // Update atomic data with Timeline configuration
    atomicDataRef.ganttChartState.setAtomicData( {
        ...atomicDataRef.ganttChartState.getAtomicData(),
        ganttConfig: getPlanTimelineGanttConfig(),
        zoomLevel: getValidZoomLevel( zoomLevel && zoomLevel[ 0 ] ? zoomLevel[ 0 ] : 'unit_of_time_measure', planObj ),
        callbacks: new Pgp0PlanTimelineCallbacks()
    } );

    return {
        isTimelineChartStateInited: true,
        timelineDataService: new Pgp0PlanTimelineDataService()
    };
};

/**
 * Initialize the basic Timeline properties for loading the Timeline chart.
 * @param {Date} startDate The start date of the Timeline chart.
 * @param {Date} endDate The finish date of the Timeline chart.
 * @returns {Object} The Timeline properties
 */
const getPlanTimelineGanttConfig = () => {
    let timelineConfig = awGanttConfigService.getDefaultConfiguration();
    timelineConfig.scale_height = 72; // XLARGE
    timelineConfig.bar_height = 'full';
    timelineConfig.drag_links = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
    timelineConfig.drag_move = true;
    timelineConfig.drag_resize = true;
    timelineConfig.link_wrapper_width = 20;
    timelineConfig.order_branch = true;
    timelineConfig.order_branch_free = true;
    timelineConfig.readonly = false;
    timelineConfig.show_grid = false;
    timelineConfig.fit_tasks = false;
    timelineConfig.multiselect = false;
    timelineConfig.tooltip_hide_timeout = 1500;
    return timelineConfig;
};

const attachTimelineEventCallbacks = ( ganttInstance ) => {
    ganttInstance.event( window, 'click', function( e ) {
        timelineCallbacks.onWindowClick( e );
    } );
};

/**
 * Updates the parent selection based on the local selection.
 * @param {Object} localSelectionData Local selection data
 * @param {Object} parentSelectionData Parent selection data
 */
export const updateParentSelection = ( localSelectionData, parentSelectionData ) => {
    let selObjects = [];
    localSelectionData.selected && localSelectionData.selected.forEach( ( taskId ) => {
        if( taskId.indexOf( '__' ) > -1 ) {
            taskId = taskId.substring( 0, taskId.indexOf( '__' ) );
        }
        selObjects.push( cdm.getObject( taskId ) );
    } );

    if( !parentSelectionData.getValue().selected || _.xorBy( selObjects, parentSelectionData.getValue().selected, 'uid' ).length > 0 ) {
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected: selObjects } );
    }
};

/**
 * Updates the local selection based on the parent selection.
 * @param {*} localSelectionData Local selection data
 * @param {*} parentSelectionData Parent selection data
 * @param {*} atomicDataRef Atomic data
 */
export const updateLocalSelection = ( localSelectionData, parentSelectionData, atomicDataRef ) => {
    parentSelectionData && parentSelectionData.getValue().selected && atomicDataRef.selectionData.setAtomicData( {
        id: 'selectionData',
        selected: parentSelectionData.getValue().selected.map( object => object.uid )
    } );
};

/**
 * Pushes the initial data loaded in tree table to the Timeline Chart. This is done after
 * the Timeline Chart is initialized and ready to parse the data to be displayed in Timeline.
 */
export const pushInitialDataToTimeline = ( timelineDataService, treeTableData, timelineData, atomicDataRef ) => {
    let isTimelineDataInited = false;
    if( treeTableData && treeTableData.getValue().rootNode ) {
        let rootNode = treeTableData.getValue().rootNode;
        addTreeNodesToTimeline( timelineDataService, rootNode, atomicDataRef );
        pushEventsToTimeline( timelineData, atomicDataRef, timelineDataService );
        isTimelineDataInited = true;
    }
    return { isTimelineDataInited: isTimelineDataInited };
};

/**
 * Traverses the given parent node, finds the children recursively and adds
 * to the Timeline Chart.
 *
 * @param {Object} timelineDataService The Timeline data service
 * @param {Object} parentNode The parent to traverse and add children.
 * @param {Object} atomicDataRef Atomic data
 */
export const addTreeNodesToTimeline = ( timelineDataService, parentNode, atomicDataRef ) => {
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    childNodes && childNodes.forEach( ( node ) => {
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addTask( {
            ...timelineDataService.constructGanttObject( cdm.getObject( node.uid ) ),
            parent: parentNode.uid,
            $open: node.isExpanded && node.isExpanded === true
        },
        parentNode.uid );
    } );

    childNodes && childNodes.forEach( ( node ) => { addTreeNodesToTimeline( node, atomicDataRef ); } );
};

export const subscribeEvents = ( timelineDataService, atomicDataRef ) => {
    const getGanttInstance = ( atomicDataRef ) => atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let eventSubscriptions = [];
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTreeDataProvider.treeNodesLoaded', ( eventData ) => timelineCallbacks.onTreeNodesLoaded( eventData, timelineDataService,
        atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.plTable.toggleTreeNode', ( node ) => timelineCallbacks.onToggleTreeNode( node, atomicDataRef ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.dependenciesLoaded', ( eventData ) => ganttCallbacks.onDependenciesLoaded( eventData, ganttDataService, atomicDataRef ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.collapseBelow', ( eventData ) => ganttCallbacks.onCollapseBelow( eventData, atomicDataRef ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.nodesAdded', ( eventData ) => timelineCallbacks.onNodesAdded( eventData, timelineDataService, getGanttInstance(
        atomicDataRef ) ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.eventsAdded', ( eventData ) => timelineCallbacks.onEventsAdded( eventData, timelineDataService, getGanttInstance(
    //     atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.nodesRemoved', ( eventData ) => timelineCallbacks.onNodesRemoved( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.plansReordered', ( eventData ) => timelineCallbacks.onPlansReordered( eventData, getGanttInstance( atomicDataRef ) ) ) );
    // eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.dependenciesAdded', ( eventData ) => ganttCallbacks.onDependenciesAdded( eventData, ganttDataService, getGanttInstance(
    // atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'planNavigationTree.dependenciesDeleted', ( eventData ) => timelineCallbacks.onDependenciesDeleted( eventData, getGanttInstance( atomicDataRef ) ) ) );
    eventSubscriptions.push( eventBus.subscribe( 'cdm.updated', ( eventData ) => timelineCallbacks.onObjectsUpdated( eventData, timelineDataService, atomicDataRef ) ) );

    // Listen to Tree table scroll to sync up Timeline scroll
    timelineScrollService.registerTable2TimelineScrollSync();

    return { eventSubscriptions };
};

const resetGanttChart = ( ganttInstance ) => {
    if( ganttInstance ) {
        let links = ganttInstance.getLinks();
        let childIds = ganttInstance.getChildren( ganttInstance.getTaskByIndex( 0 ).id );

        ganttInstance.batchUpdate( () => {
            links.forEach( link => ganttInstance.isLinkExists( link.id ) && ganttInstance.deleteLink( link.id ) );
            childIds.forEach( childId => ganttInstance.isTaskExists( childId ) && ganttInstance.deleteTask( childId ) );
        } );
    }
};

export const pushEventsToTimeline = ( timelineData, atomicDataRef, timelineDataService ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    attachTimelineEventCallbacks( atomicDataRef.ganttChartState.getAtomicData().ganttInstance );
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    if( timelineData.eventObjects ) {
        timelineData.eventObjects.sort( ( a, b ) => a.props.prg0PlannedDate.dbValues[ 0 ] >= b.props.prg0PlannedDate.dbValues[ 0 ] ? 1 : -1 );
        let uids = [];
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.batchUpdate( () => {
            timelineData.eventObjects.forEach( ( event ) => {
                let parentUid = event.props.prg0PlanObject.dbValues[ 0 ];
                atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addTask(
                    timelineDataService.constructGanttObject( cdm.getObject( event.uid ) ),
                    parentUid );
                uids.push( event.uid );
            } );
        } );
        let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
        ganttInstance.recalculateStackedObjInfo( uids );
        let eventDependenciesFlag = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
        if( eventDependenciesFlag ) {
            eventBus.publish( 'fetchEventDependencies', timelineData.eventObjects );
        }
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.render();
        eventBus.publish( 'planTimelineChart.eventsAddedOnTimeline', timelineData.eventObjects );
    }
};

const getValidZoomLevel = ( zoomLevel, planObj ) => {
    // Map of UnitofTimeMeasure LOV values to Timeline zoom level names.
    const uotmZoomLevelMap = { h: 'day', d: 'day', w: 'week', q: 'quarter', mo: 'month' };
    if( zoomLevel === 'unit_of_time_measure' ) {
        zoomLevel = uotmZoomLevelMap[ _.get( planObj, 'props.prg0UnitOfTimeMeasure.dbValues[0]', 'd' ) ];
    }
    return zoomLevel;
};

export const onEventsAdded = ( eventData, timelineDataService, atomicDataRef, parentSelectionData ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    timelineCallbacks.onEventsAdded( eventData, timelineDataService, ganttInstance );
    const localSelectionData = {
        selected: [ eventData.addedEvents[ 0 ].uid ]
    };
    if( !appCtxSvc.getCtx( 'isCreateEventPanelPinned' ) ) {
        updateParentSelection( localSelectionData, parentSelectionData );
    }
};

export const onMilestonesAdded = ( eventData, timelineDataService, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    timelineCallbacks.onMilestonesAdded( eventData, timelineDataService, ganttInstance );
};

export const removeMilestonesForPlans = ( eventData, atomicDataRef ) => {
    let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let milestonesToHide = [];
    eventData.removeMilestonesForPlan && eventData.removeMilestonesForPlan.forEach( ( planUid ) => {
        let childObjects = ganttInstance.getChildren( planUid );
        childObjects && childObjects.forEach( ( childUid ) => {
            let schTaskUid = childUid;
            if( childUid.indexOf( '__' ) > -1 ) {
                childUid = childUid.substring( 0, childUid.indexOf( '__' ) );
            }
            let timelineObject = cdm.getObject( childUid );
            if( timelineObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
                milestonesToHide.push( schTaskUid );
            }
        } );
    } );
    timelineCallbacks.onNodesRemoved( { removedNodeUids: milestonesToHide }, ganttInstance );
};

export const setZoomLevel = ( zoomLevel, atomicDataRef, planObject ) => {
    let newZoomLevel = getValidZoomLevel( zoomLevel, planObject );
    if( atomicDataRef.ganttChartState.getAtomicData().zoomLevel !== newZoomLevel ) {
        atomicDataRef.ganttChartState.setAtomicData( { ...atomicDataRef.ganttChartState.getAtomicData(), zoomLevel: newZoomLevel } );
    }
};

export const updateTimelineZoomLevelPref = ( prefValue, planObject, newZoomLevel ) => {
    let prefZoomLevel = getValidZoomLevel( prefValue, planObject );
    if( prefZoomLevel !== newZoomLevel ) {
        appCtxSvc.updatePartialCtx( 'preferences.AWC_Timeline_Zoom_Level', [ newZoomLevel ] );
    }
};

export const formatNewPlannedDate = ( updatedInfo ) => {
    if( updatedInfo && updatedInfo[ 0 ] && updatedInfo[ 0 ].plannedDate ) {
        return dateTimeService.formatUTC( updatedInfo[ 0 ].plannedDate );
    }
    return '';
};

export let createEventDependency = ( predecessorEventUid, successorEventUid, dependencyUid, timelineDataService, atomicDataRef ) => {
    //To handle event dependency scenario
    let dependency = cdm.getObject( dependencyUid );
    dependency.props.primary_object = {
        dbValues: [ successorEventUid ]
    };
    dependency.props.secondary_object = {
        dbValues: [ predecessorEventUid ]
    };
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addLink( timelineDataService.constructGanttObject( dependency ) );
};

export let toggleEventDependenciesDisplay = ( atomicDataRef ) => {
    let eventDependenciesFlag = appCtxSvc.getCtx( 'showHideEventDependencyFlag' );
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.show_links = !eventDependenciesFlag;
    appCtxSvc.registerCtx( 'showHideEventDependencyFlag', !eventDependenciesFlag );
    /* If the toggle is ON then:
        1. Fetch the existing dependencies and render them.
        2. Allow to create dependency
    */
    let eventsOnTimeline = getEventsFromTimeLine( atomicDataRef );
    if( !eventDependenciesFlag && eventsOnTimeline.length > 0 ) {
        //Hide event info when dependency command button is toggle on
        appCtxSvc.registerCtx( 'showEventProperties', false );
        atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.drag_links = !eventDependenciesFlag;
        eventBus.publish( 'fetchEventDependencies', eventsOnTimeline );
    }
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.render();
};

/**
 * Get all events from DHTMLX timeline
 *
 * @return {Array} events event list from timeline
 */
const getEventsFromTimeLine = ( atomicDataRef ) => {
    let events = [];
    // get all event list from timeline using DHTMLX API
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.eachTask( function( task ) {
        let modelObject = cdm.getObject( task.id.split( '__' )[ 0 ] );
        if( modelObject && modelObject.modelType && cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

export const prepareEventDepsForTimeline = ( response, atomicDataRef, timelineDataService ) => {
    let dependencyObjects = [];
    for( let i = 0; i < response.output.length; i++ ) {
        let output = response.output[ i ];
        let relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
        if( relationshipObjects.length > 0 ) {
            for( let index = 0; index < relationshipObjects.length; index++ ) {
                let dependecyObj = relationshipObjects[ index ].relation;
                if( !atomicDataRef.ganttChartState.getAtomicData().ganttInstance.isLinkExists( dependecyObj.uid ) ) {
                    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addLink( timelineDataService.constructGanttObject( dependecyObj ) );
                }
            }
        }
    }
    // addAndRenderDependencies( dependencyObjects );
};

export const confirmDeleteOfEventDependency = ( dependenciesToDelete, atomicDataRef ) => {
    if( !dependenciesToDelete && !dependenciesToDelete.dependencyDeletes && !dependenciesToDelete.dependencyDeletes[ 0 ] ) {
        return;
    }
    let dependencyToDelete = dependenciesToDelete.dependencyDeletes[ 0 ];
    let secondaryEventNameString;
    let primaryEventNameString;
    let timelineDependency = atomicDataRef.ganttChartState.getAtomicData().ganttInstance.getLink( dependencyToDelete.uid );
    if( timelineDependency ) {
        let sourceObject = cdm.getObject( timelineDependency.source );
        let targetObject = cdm.getObject( timelineDependency.target );
        if( sourceObject && targetObject ) {
            secondaryEventNameString = sourceObject.props.object_name.dbValues[ 0 ];
            primaryEventNameString = targetObject.props.object_name.dbValues[ 0 ];
        }
    }
    if( secondaryEventNameString && primaryEventNameString && dependencyToDelete &&
        dependencyToDelete.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1 ) {
        var messageParams = {
            secondaryEventName: secondaryEventNameString,
            primaryEventName: primaryEventNameString
        };
        eventBus.publish( 'deleteEventConfirmationMessage', messageParams );
    }
};

export const selectObjectOnTimeline = ( objectUid, atomicDataRef ) => {
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( timelineInstance.isTaskExists( objectUid ) ) {
        timelineInstance.batchUpdate( function() {
            timelineInstance.eachSelectedTask( function( task_id ) {
                timelineInstance.unselectTask( task_id );
            } );
            timelineInstance.selectTask( objectUid );
            timelineInstance.showTask( objectUid );
            atomicDataRef.selectionData.setAtomicData( { ...atomicDataRef.selectionData.getAtomicData(), selected: [ objectUid ] } );
        } );
    } else //If event is not loaded OR event is loaded and its plan object is not in expanded state
    {
        eventBus.publish( 'fetchAllParentOfEvent', objectUid );
    }
};

export const getEventsFromTimeline = ( atomicDataRef ) => {
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let events = [];
    // get all event list from timeline using DHTMLX API
    timelineInstance.eachTask( function( task ) {
        let modelObject = cdm.getObject( task.id.split( '__' )[ 0 ] );
        if( modelObject && modelObject.modelType && cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

export const updateTimelineEvents = ( timelineEvents, atomicDataRef, timelineDataService ) => {
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    const objectUids = [];
    timelineInstance.batchUpdate( () => {
        timelineEvents.forEach( ( timelineEvent ) => {
            timelineDataService.updateGanttObject( timelineEvent, timelineInstance );
            objectUids.push( timelineEvent.uid );
        } );
    } );
    timelineInstance.recalculateStackedObjInfo( objectUids );
};

export const unsubscribeEvents = ( eventSubscriptions ) => {
    // Stop listening to Tree table scroll.
    timelineScrollService.unRegisterTable2TimelineScrollSync();
    eventSubscriptions.forEach( event => event && eventBus.unsubscribe( event ) );
    return { eventSubscriptions: [] };
};

export const showHideEventInfo = ( atomicDataRef, showOrHideInfo ) => {
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.showEventProperties = showOrHideInfo;

    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.show_links = false;
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.config.drag_links = false;
    appCtxSvc.registerCtx( 'showHideEventDependencyFlag', false );
    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.refreshData();
};

export let hideAllMilestones = ( rootNode, atomicDataRef ) => {
    let planObjects = [];
    getAllPlanObjects( rootNode, planObjects );
    let planUids = planObjects.map( plan => plan.uid );
    removeMilestonesForPlans( { removeMilestonesForPlan: planUids }, atomicDataRef );
};

export let showAllMilestones = ( rootNode, planNavigationContext ) => {
    let planObjects = [];
    getAllPlanObjects( rootNode, planObjects );
    eventBus.publish( 'planNavigationTree.planObjectsLoaded', { newLoadedPlanObjects: planObjects, planNavigationContext: planNavigationContext } );
};

export let getAllPlanObjects = ( rootPlanNode, planObjects ) => {
    if( rootPlanNode ) {
        planObjects.push( rootPlanNode );
        let childNodes = rootPlanNode.children;

        if( !childNodes && rootPlanNode.__expandState && rootPlanNode.__expandState.children ) {
            childNodes = rootPlanNode.__expandState.children;
        }
        if( childNodes ) {
            childNodes.forEach( ( node ) => {
                getAllPlanObjects( node, planObjects );
            } );
        }
    }
};

export let scrollToDateInTimeline = function( dateString, isToday, i18n, atomicDataRef ) {
    let date = new Date();
    if( !isToday ) {
        date = new Date( dateString );
    }
    let dateToScroll = new Date( date.getFullYear(), date.getMonth(), date.getDate() );
    let dateToShowInMsg = dateTimeService.formatDate( dateToScroll );
    let timelineInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    let dates = timelineInstance.getSubtaskDates(); //gets program's first event's and last event's date
    let startDateBoundary = new Date( dates.start_date.getFullYear(), dates.start_date.getMonth(), dates.start_date.getDate() );
    let endDateBoundary = new Date( dates.end_date.getFullYear(), dates.end_date.getMonth(), dates.end_date.getDate() );
    //the below lines check whether out of program boundary dates are entered or not
    if( endDateBoundary.getTime() < dateToScroll.getTime() ) {
        let message = i18n.Pgp0GoToOutOfBoundAfter;
        let dateLast = dateTimeService.formatDate( dates.end_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateLast}}' ], {
            dateToShow: dateToShowInMsg,
            dateLast: dateLast
        } );
        messagingService.showInfo( outOfBoundMessage );
    } else if( startDateBoundary.getTime() > dateToScroll.getTime() ) {
        let message = i18n.Pgp0GoToOutOfBoundBefore;
        let dateFirst = dateTimeService.formatDate( dates.start_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateFirst}}' ], {
            dateToShow: dateToShowInMsg,
            dateFirst: dateFirst
        } );
        messagingService.showInfo( outOfBoundMessage );
    }
    //For scrolling
    let position = timelineInstance.posFromDate( dateToScroll ); //settig the leftmost position of timeline as the date
    timelineInstance.scrollTo( position ); //scrolling to the position set
};
