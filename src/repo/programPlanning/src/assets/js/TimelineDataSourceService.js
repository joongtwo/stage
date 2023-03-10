//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/TimelineDataSourceService
 */
import eventBus from 'js/eventBus';
import timelineUtils from 'js/Timeline/uiTimelineUtils';
import stackedEventsSvc from 'js/StackedEventsService';
import prgTimelineUtils from 'js/TimelineUtils';
import _cmm from 'soa/kernel/clientMetaModel';
import _cdm from 'soa/kernel/clientDataModel';
import _dateTimeSvc from 'js/dateTimeService';
import selectionSvc from 'js/selection.service';
import ctxService from 'js/appCtxService';
import timelineManager from 'js/uiGanttManager';
import _ from 'lodash';
import timelineEveDepService from 'js/TimelineEventDependencyService';

'use strict';

var exports = {};

/**
 * The Map of uid to time line info..
 */
var uidToInfoMap = new Object();

/**
 * The Map of uid to IModelObject.
 */
var uidToModelObjectMap = new Object();

/**
 * The List of time line info about plan objects.
 */
var planObjectsInfo = [];

/**
 * The boolean indicating if the Schedule has more tasks?
 */
var hasMoreData = false;

/**
 * Boolean indicating if a pagination request is in process?
 */
var paginationStarted = false;

/**
 * Selection Object
 */
var selections = [];

/**
 * Method to get the Value from uidToInfoMap.
 *
 * @param {var} key - key of uidToInfoMap.
 * @return value of the key.
 */
var getInfoFromUid = function( key ) {
    return uidToInfoMap[ key ];
};

/**
 * Method to get the Value from uidToModelObjectMap.
 *
 * @param {var} key - key of uidToModelObjectMap.
 * @return value of the key.
 */
var getModelObjectFromUid = function( key ) {
    return uidToModelObjectMap[ key ];
};

/**
 * Method to pass on the data to Timeline Util function for further processing
 *
 * @param {var} id  - Id of the Event that is dragged
 * @param {date} plannedDate - New Date to be set after Event is dragged
 * @param {var} mode - The drag-and-drop Mode
 */
export let onEventDrag = function( id, plannedDate, mode ) {
    return prgTimelineUtils.onEventDrag( id, plannedDate, mode );
};

/**
 * Method to pass on the data to Timeline Util function for further processing
 * @param {var} id  - Id of the link
 */
export let deleteDependency = function( id ) {
    return timelineEveDepService.deleteDependency( id );
};

/**
 * Method to pass on the data to Timeline Util function for further processing
 * @param {var} id  - Id of the link
 */
export let selectLink = function( id ) {
    // return timelineEveDepService.selectLink( id );
};

/**
 * Method to pass on the data to Timeline Util function for further processing
 */
export let unSelectLink = function() {
    return timelineEveDepService.unSelectLink();
};
/**
 * Method to pass on the data to Timeline Util function for further processing
 * @param {var} id  - Id of the link
 */
export let isValidLink = function( id ) {
    return timelineEveDepService.isValidLink( id );
};

/**
 * Added this methods to deprecate reverse depedency from programPlanning to gantt
 * Method to pass on the data to Timeline Util function for further processing
 * @param {var} type  - type of object
 * @param {var} source  - source event
 */
export let checkDuplicateDependency = function( source, target ) {
    return timelineEveDepService.checkDuplicateDependency( source, target );
};

/**
 * Method to pass on the data to Timeline Util function for further processing
 * @param {var} type  - type of object
 * @param {var} source  - source event
 * @param {var} target  - target event
 */
export let createLink = function( type, source, target ) {
    //return timelineEveDepService.createLink( type, source, target );
};

/**
 * Method that:
 * a) Resets the result string everytime dropdown selection changes
 * b) Clears Events result when Del Instance searched for and vice-versa
 * It is done so that if drop down selecton changes previous search results are cleared
 *
 * @param {data} data - Contains the data providers result
 */
export let clearDataProviderResults = function( data ) {
    if( data.resultString && data.resultString.dbValue ) {
        data.resultString.dbValue = '';
    }
    if( data.timelineSearchBy.dbValue === 'Event' ) {
        data.dataProviders.Psi0PrgDelSearchProvider.viewModelCollection.clear();
    } else {
        data.dataProviders.pgp0PlanObjsSearchProvider.viewModelCollection.clear();
    }
};

/**
 * Method to build the search result string that shows the count
 * E.g.: (4 Results)
 *
 * @param {data} data - Contains the data providers result
 */
export let buildResultString = function( searchResultLength, i18nResultStr ) {
    return '(' + searchResultLength + ' ' + i18nResultStr + ')';
};

/**
 * Method that check if PSI0 template is installed.
 *
 * @param {response} response - SOA response
 */
export let checkForPsi0BOTypes = function( response ) {
    var timelineContext = ctxService.getCtx( 'timelineContext' );
    timelineContext.isPsi0TemplateInstalled = false;
    if( response && response.types && response.types.length > 0 ) {
        timelineContext.isPsi0TemplateInstalled = true;
    }
    ctxService.updateCtx( 'timelineContext', timelineContext );
};

/**
 * Method to set the id for highlighting
 *
 * @param {data} data - Contains the data providers result
 */
export let setInputForSelection = function( data ) {
    var id;
    if( data.timelineSearchBy.dbValue === 'Event' ) {
        id = data.dataProviders.pgp0PlanObjsSearchProvider.selectedObjects[ 0 ].uid;
    } else {
        id = data.dataProviders.Psi0PrgDelSearchProvider.selectedObjects[ 0 ].uid;
    }
    if( id ) {
        exports.callSelectTaskOnTimeline( id );
    }
};

/**
 * Method to highlight and scroll to Planned Date of the selected Event.
 *
 * @param {var} id - Selected Event object's UID
 */
export let callSelectTaskOnTimeline = function( id ) {
    if( id ) {
        //If event is loaded and its plan object is in expanded state
        if( timelineManager.getGanttInstance().isTaskExists( id ) ) {
            timelineManager.getGanttInstance().selectTask( id );
            timelineManager.getGanttInstance().showTask( id );
        } else //If event is not loaded OR event is loaded and its plan object is not in expanded state
        {
            eventBus.publish( 'fetchAllParentOfEvent', id );
        }
    }
};

/**
 * Method to set the first search result as default selection
 *
 * @param {object} data - Data object
 */
export let reloadTimeline = function( data ) {
    if( data && data.searchResults && data.searchResults.length > 0 ) {
        var vmc;
        if( data.timelineSearchBy.dbValue === 'Event' ) {
            vmc = data.dataProviders.pgp0PlanObjsSearchProvider.viewModelCollection;
        } else {
            vmc = data.dataProviders.Psi0PrgDelSearchProvider.viewModelCollection;
        }
        var index = vmc.findViewModelObjectById( data.searchResults[ 0 ].uid );
        if( index > -1 ) {
            var vmo = vmc.getViewModelObject( index );
            if( data.timelineSearchBy.dbValue === 'Event' ) {
                data.dataProviders.pgp0PlanObjsSearchProvider.selectionModel.setSelection( vmo );
            } else {
                data.dataProviders.Psi0PrgDelSearchProvider.selectionModel.setSelection( vmo );
            }
        }
        let loadedObjects = vmc.loadedVMObjects;
        loadedObjects.forEach( ( loadedObject ) => {
            if( timelineManager.getGanttInstance().isTaskExists( loadedObject.uid ) ) {
                timelineManager.getGanttInstance().refreshTask( loadedObject.uid );
            }
        } );
    }
};

/**
 * Method to unregister the variable in ctx after ViewModel is unloaded.
 *
 * @param {object} ctx - Context object
 */
export let clearDataForHighlight = function( ctx ) {
    ctxService.unRegisterCtx( 'populateEventData' );
    ctxService.unRegisterCtx( 'timelineSearchBy' );
};

/**
 * Method to store selective parameters returned by data provider in ctx for further processing.
 *
 * @param {object} data - Data object
 */
export let populateDataForHighlight = function( data ) {
    ctxService.registerCtx( 'populateEventData', {} );
    var searchResultsArr = [];
    if( data.searchResults ) {
        for( var i = 0; i < data.searchResults.length; i++ ) {
            searchResultsArr.push( data.searchResults[ i ].uid );
        }
    }
    var populateEventData = ctxService.getCtx( 'populateEventData' );
    populateEventData.dataProvider = data.dataProviders.pgp0PlanObjsSearchProvider;
    populateEventData.searchResults = searchResultsArr;
    if( ctxService.ctx.populateEventData ) {
        ctxService.updateCtx( 'populateEventData', populateEventData );
    }
};

/**
 * This function will set the Event properties flag to true
 * It will then be used to show event properties in Timeline view
 */
export let showEventProperties = function() {
    ctxService.registerCtx( 'showEventProperties', !ctxService.ctx.showEventProperties );

    //Hide dependency link when event info command button is toggle on
    if( ctxService.ctx.showEventProperties ) {
        timelineManager.getGanttInstance().config.show_links = false;
        timelineManager.getGanttInstance().config.drag_links = false;
        ctxService.registerCtx( 'showHideEventDependencyFlag', false );
        eventBus.publish( 'showEventProperties' );
    }
    timelineManager.getGanttInstance().render();
};

/**
 * This will reset the Context.
 *
 * @param {Object} ctx - Context object.
 */
export let revertCtx = function( ctx ) {
    selectionSvc.updateSelection( ctx.locationContext.modelObject, ctx.locationContext.modelObject );
};

/**
 * Returns time in millseconds.
 *
 * @return {String} milliseconds - time in milliseconds.
 */
var getCurrentTimeInMillSecond = function() {
    var startDate = new Date();
    return startDate.getMilliseconds();
};

/**
 * Returns the difference between the end and start date.
 *
 * @param {String} end - The end time.
 * @param {String} start - The start time.
 * @return The difference in Long.
 */
var diffLong = function( end, start ) {
    return end - start;
};

/**
 * Calls the Load Plan Hierarchy Paginate Call.
 *
 * @param {Object} result - The response of SOA.
 */
export let paginatePlanAndEvents = function( result ) {
    var loadedInfos = [];
    var soaResponseGot = getCurrentTimeInMillSecond();
    console.log( '7. Pagination SOA response recieved. Processinf response:' );
    var timeLinesAndEvents = [];
    try {
        var planEventsData = result.planEventsData;
        for( var newIdx in planEventsData ) {
            var planEvent = planEventsData[ newIdx ];
            var plan = _cdm.getObject( planEvent.plan.uid );
            var planInfo = addPlanInfo( plan, planEventsData[ 0 ] );
            loadedInfos.push( planInfo );

            var events = [];
            for( var newIdx in planEvent.events ) {
                var event = _cdm.getObject( planEvent.events[ newIdx ].uid );
                events.push( event );
            }

            for( var newEventIdx in events ) {
                var eventInfo = addEventInfo( events[ newEventIdx ] );
                loadedInfos.push( eventInfo );
            }
        }

        var hasMore = result.hasMorePlanObjects;
        hasMoreData = hasMore;

        for( var info in loadedInfos ) {
            var parent = loadedInfos[ info ].parent;
            var parentUID = null;
            if( parent !== null || typeof parent !== typeof undefined ) {
                parentUID = parent;
            }
            var objectInloadedInfos = _cdm.getObject( loadedInfos[ info ].uid );
            if( _cmm.isInstanceOf( 'Prg0AbsEvent', objectInloadedInfos.modelType ) ) {
                var plannedDateObj = new Date( loadedInfos[ info ].plannedDate );
                var plannedDate = _dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );
                var forecastDateObj = null;
                if( loadedInfos[ info ].forecastDate ) {
                    forecastDateObj = new Date( loadedInfos[ info ].forecastDate );
                }
                var forecastDate = _dateTimeSvc.formatNonStandardDate( forecastDateObj, 'yyyy-MM-dd' );
                var actualDateObj = null;
                if( loadedInfos[ info ].actualDate ) {
                    actualDateObj = new Date( loadedInfos[ info ].actualDate );
                }
                var actualDate = _dateTimeSvc.formatNonStandardDate( actualDateObj, 'yyyy-MM-dd' );
                var event = constructEvent( plannedDate,
                    'milestone', 'Event', forecastDate, actualDate, loadedInfos[ info ] );
                timeLinesAndEvents.push( event );
            } else {
                var timeline = constructTimeline( loadedInfos[ info ].uid, loadedInfos[ info ].name,
                    loadedInfos[ info ].type, parentUID, loadedInfos[ info ].status, loadedInfos[ info ].objectType );
                timeLinesAndEvents.push( timeline );
            }
        }
        //Call the native method to show more data.
        console.log( '8. SOA response processing finished preparing to render data: ' );
        var soaResponseProcessEnd = getCurrentTimeInMillSecond();
        var delta = diffLong( soaResponseProcessEnd, soaResponseGot );
        console.log( '9. Total time for processing SOA response took: ' + delta + ' milliseconds ' );
    } catch ( error ) {
        console.error( error );
    } finally {
        paginationStarted = false;
    }
    return timeLinesAndEvents;
};

/**
 * This will invoke when we select any item in Timeline.
 *
 * @param {String} id - The uid of the selected object.
 */
export let select = function( id ) {
    var task = _cdm.getObject( id );
    eventBus.publish( 'selectionChangedOnTimeline', task );
    let locationContext = ctxService.getCtx( 'locationContext' );
    eventBus.publish( 'selectEventOnTimeline', task );
};

/**
 * This will invoke when we deselect any item.
 */
export let deSelect = function() {
    exports.revertCtx( ctxService.ctx );
    eventBus.publish( 'selectionChangedOnTimeline', selections );
};

/**
 * This function will add the new plan items.
 *
 * @param {Object} object - The newly created plan object.
 * @param {Object} ctx - The Context Object
 * @return {Object} info - The TimeLineInfo representing the newly created plan object.
 */
var addNewPlanInfo = function( object, ctx ) {
    var info;
    info = getInfoFromUid( object.uid );
    if( info === null || typeof info === typeof undefined ) {
        var typeProp = getIntegerType( object );
        var nameProp = object.props.object_name.dbValues[ 0 ];
        var statusProp = object.props.prg0State.dbValues[ 0 ];
        var parentPlanProp = object.props.prg0ParentPlan.dbValues[ 0 ];
        var objectTypeProp = object.props.object_type.dbValues[ 0 ];

        var childs = [];
        info = {
            uid: object.uid,
            name: nameProp,
            type: typeProp,
            status: statusProp,
            parent: '',
            children: childs,
            objectType: objectTypeProp
        };
        if( info !== null || typeof info !== typeof undefined ) {
            var parentPlanInfo;
            parentPlanInfo = getInfoFromUid( parentPlanProp );

            if( typeof parentPlanInfo !== typeof undefined ) {
                planObjectsInfo.push( info );

                info.parent = parentPlanProp;

                for( var index in planObjectsInfo ) {
                    if( planObjectsInfo[ index ].uid === parentPlanInfo.uid ) {
                        for( var newIdx in planObjectsInfo ) {
                            if( planObjectsInfo[ newIdx ].uid === object.uid ) {
                                planObjectsInfo[ index ].children.push( planObjectsInfo[ newIdx ] );
                                break;
                            }
                        }
                        break;
                    }
                }
            }
        }

        uidToModelObjectMap[ object.uid ] = object;
        uidToInfoMap[ object.uid ] = info;
    }
    return info;
};

/**
 * This will add the Plan items.
 *
 * @param {Object} object - object to be added.
 * @param {Object} rootEle - Root element in Tree Structure
 * @return {Object} tasks - The task Object.
 */
export let addPlan = function( object, rootEle ) {
    var info = addPlanInfo( object, rootEle );
    var tasks;

    tasks = constructTimeline( info.uid, info.name, info.type, info.parent, info.status, info.objectType );
    return tasks;
};

/**
 * This will check the type of the model Object.
 *
 * @param {Object} modelObject - The model Object.
 * @return {Integer} type - The type of the Object.
 */
var getIntegerType = function( modelObject ) {
    var objType = modelObject.modelType;
    var type;
    if( _cmm.isInstanceOf( 'Prg0AbsProgramPlan', objType ) ) {
        type = 0;
    } else if( _cmm.isInstanceOf( 'Prg0AbsProjectPlan', objType ) ) {
        type = 1;
    } else if( _cmm.isInstanceOf( 'Prg0AbsEvent', objType ) ) {
        type = 4;
    } else if( _cmm.isInstanceOf( 'ScheduleTask', objType ) ) {
        type = 5;
    } else {
        type = -1;
    }
    return type;
};

/**
 * This will set the previous sibling.
 *
 * @param {Object} plan - The Input plan object.
 * @param {String} prevID - The Previous Sibling ID.
 * @return {Object} plan - The Java Script object
 */
var setPlanPreviousSibling = function( plan, prevID ) {
    plan.prevID = prevID;
    return plan;
};

/**
 * The function will invoke when we create plan in timeline.
 *
 * @param {Object} addedNodes - plan objects.
 */
export let addPlanObjects = function( addedNodes ) {
    if( !addedNodes || addedNodes.length <= 0 ) {
        return;
    }

    let createdInfos = [];
    addedNodes.forEach( node => {
        let planObject = _cdm.getObject( node.uid );
        let plan = addNewPlanInfo( planObject, ctxService.ctx );
        if( plan && plan.parent ) {
            let timeline = constructTimeline( plan.uid, plan.name, plan.type, plan.parent, plan.status, plan.objectType );
            var parentPlanInfo = getInfoFromUid( plan.parent.uid );

            // If there are existing children, then update the sibling info for the new plan to be added.
            if( parentPlanInfo && parentPlanInfo.children && parentPlanInfo.children.length > 1 ) {
                setPlanPreviousSibling( timeline, parentPlanInfo.uid );
                var idx;
                for( idx in parentPlanInfo.children ) {
                    if( parentPlanInfo.children[ idx ].uid === plan.uid ) {
                        break;
                    }
                }
                //get last child
                --idx;
                if( idx > -1 ) {
                    var prevSibling = parentPlanInfo.children[ idx ];
                    setPlanPreviousSibling( timeline, prevSibling.uid );
                }
            }
            createdInfos.push( timeline );
        }
    } );

    if( createdInfos.length > 0 ) {
        timelineUtils.addCreatedObjectsOnTimeline( createdInfos );
    }
};

/**
 * The function will invoke when we create event in timeline.
 *
 * @param {Object} addedEvents - events to be added.
 */
export let addEventObjects = function( addedEvents ) {
    if( !addedEvents || addedEvents.length <= 0 ) {
        return;
    }

    let createdInfos = [];
    addedEvents.forEach( eventObject => {
        var event = addEventInfo( eventObject );
        var plannedDateObj = new Date( event.plannedDate );
        var forecastDateObj = null;
        if( event.forecastDate ) {
            forecastDateObj = new Date( event.forecastDate );
        }
        var actualDateObj = null;
        if( event.actualDate ) {
            actualDateObj = new Date( event.actualDate );
        }
        var plannedDate = _dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );
        var forecastDate = _dateTimeSvc.formatNonStandardDate( forecastDateObj, 'yyyy-MM-dd' );
        var actualDate = _dateTimeSvc.formatNonStandardDate( actualDateObj, 'yyyy-MM-dd' );
        let timeline = constructEvent( plannedDate, 'milestone', 'Event', forecastDate, actualDate, event );
        createdInfos.push( timeline );
    } );

    if( createdInfos.length > 0 ) {
        // Add event to the timeline
        timelineUtils.addCreatedObjectsOnTimeline( createdInfos );

        // If a single event is created, scroll and select the event.
        if( createdInfos.length === 1 ) {
            eventBus.publish( 'scrollToAndSelectEvent', _cdm.getObject( createdInfos[ 0 ].uid ) );
        }

        // Update the stacked event count
        addedEvents.forEach( eventObject => {
            timelineUtils.recalculateStackedEvents( eventObject.uid, true ); // call for the recalculation function
        } );
    }
};

/**
 * The function will invoke when we delete object in timeline.
 *
 * @param {Object} eventMap - eventData.
 */
export let onObjectsDeleted = function( eventMap ) {
    let deletedUids = eventMap[ 'cdm.deleted' ].deletedObjectUids;

    // Remove Plan Info, if any, and also update it's parent's children list.
    let removedPlansInfo = _.remove( planObjectsInfo, info => deletedUids.includes( info.uid ) );
    removedPlansInfo.forEach( removedPlanInfo => {
        let parentIndex = _.findIndex( planObjectsInfo, [ 'uid', removedPlanInfo.parent ] );
        if( parentIndex > -1 && planObjectsInfo[ parentIndex ].children ) {
            _.remove( planObjectsInfo[ parentIndex ].children, info => info.uid === removedPlanInfo.uid );
        }
    } );

    // Get parent plan of events to be removed, if any. Ignore if the parent is already removed.
    // This line needs to be recalcualted for stacked events.
    let parentPlanUids = [];
    deletedUids.forEach( deletedUid => {
        let modelObject = getModelObjectFromUid( deletedUid );
        if( modelObject && _cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            let parentUid = modelObject.props.prg0PlanObject.dbValues[ 0 ];
            if( !deletedUids.includes( parentUid ) ) {
                parentPlanUids.push( parentUid );
            }
        }
    } );

    // Recalculate stacked event count, if required.
    parentPlanUids.forEach( parentPlanUid => {
        let childObjects = timelineManager.getGanttInstance().getChildren( parentPlanUid );
        let childEvents = [];
        childObjects.forEach( objectId => {
            let modelObject = getModelObjectFromUid( objectId );
            if( modelObject && _cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
                childEvents.push( modelObject );
            }
        } );
        _.remove( childEvents, event => deletedUids.includes( event.uid ) );
        timelineUtils.updateStackedEventCount( parentPlanUid, childEvents, false );
        ctxService.updateCtx( 'isPopupOpen', false );
    } );

    // Clean up info maps, if any.
    deletedUids.forEach( deletedUid => {
        delete uidToInfoMap[ deletedUid ];
        delete uidToModelObjectMap[ deletedUid ];
    } );

    // Remove objects from timeline, if any.
    let deletedTimelineUids = deletedUids.filter( objUid => timelineManager.getGanttInstance().isTaskExists( objUid ) );
    if( deletedTimelineUids.length > 0 ) {
        if( deletedTimelineUids.includes( ctxService.ctx.timelineContext.selected.uid ) ) {
            //eventBus.publish( 'updateSWAForEvent', ctxService.ctx.locationContext.modelObject ); //FIXME: fix delete of Event later
        }
        eventBus.publish( 'deleteFromTimelineEvent', deletedTimelineUids );
    }
};

/**
 * This function will update the info related to plan items.
 *
 * @param {Object} modelObject - The updated Model object.
 * @return {Object} updatedObjectInfo - Updated TimeLineInfo.
 */
var updatePlanObjectInfo = function( modelObject ) {
    var updatedObjectInfo = getInfoFromUid( modelObject.uid );
    if( typeof updatedObjectInfo !== typeof undefined ) {
        var nameProp = modelObject.props.object_name.dbValues[ 0 ];
        var typeProp = getIntegerType( modelObject );
        var statusProp = modelObject.props.prg0State.dbValues[ 0 ];
        updatedObjectInfo.name = nameProp;
        updatedObjectInfo.type = typeProp;
        updatedObjectInfo.status = statusProp;
        //replace the existing element.

        var index = planObjectsInfo.indexOf( updatedObjectInfo );
        planObjectsInfo[ index ].name = updatedObjectInfo.name;
        planObjectsInfo[ index ].status = updatedObjectInfo.status;
        planObjectsInfo[ index ].type = updatedObjectInfo.type;
        uidToModelObjectMap[ modelObject.uid ] = modelObject;
        uidToInfoMap[ modelObject.uid ] = updatedObjectInfo;
    }
    return updatedObjectInfo;
};

/**
 * This function will update the info related to Event.
 *
 * @param modelObject The updated Model object.
 * @return Updated ITimeLineInfo.
 */
var updateEventInfo = function( modelObject ) {
    let configuredProperties = [];
    let preferences = ctxService.ctx.preferences;

    var updatedObjectInfo = getInfoFromUid( modelObject.uid );
    if( typeof updatedObjectInfo !== typeof undefined ) {
        var nameProp = modelObject.props.object_name.dbValues[ 0 ];
        var typeProp = getIntegerType( modelObject );
        var statusProp = modelObject.props.prg0State.dbValues[ 0 ];
        var prgPlanDateProp = modelObject.props.prg0PlannedDate.dbValues[ 0 ];
        var colorCode = modelObject.props.pgp0EventColor.dbValues[ 0 ];
        var prgForecastDateProp = modelObject.props.prg0ForecastDate.dbValues[ 0 ];
        var prgActualDateProp = modelObject.props.prg0ActualDate.dbValues[ 0 ];
        updatedObjectInfo.name = nameProp;
        updatedObjectInfo.type = typeProp;
        updatedObjectInfo.status = statusProp;
        updatedObjectInfo.colorCode = colorCode;
        updatedObjectInfo.plannedDate = prgPlanDateProp;
        updatedObjectInfo.forecastDate = prgForecastDateProp;
        updatedObjectInfo.actualDate = prgActualDateProp;

        configuredProperties = preferences.PP_Event_Information.concat( preferences.PP_Event_Tooltip_Information );
        updatedObjectInfo = getPreferenceProperties( modelObject, updatedObjectInfo, configuredProperties );

        uidToModelObjectMap[ modelObject.uid ] = modelObject;
        uidToInfoMap[ modelObject.uid ] = updatedObjectInfo;
        return updatedObjectInfo;
    }
    return updatedObjectInfo;
};

/**
 * This function will update the info related to Milestone.
 *
 * @param modelObject The updated Model object.
 * @return Updated TimeLineInfo.
 */
var updateMilestoneInfo = function( modelObject ) {
    var updatedObjectInfo = getInfoFromUid( modelObject.uid );
    var task_type = modelObject.props.task_type.dbValues[ 0 ];

    if( typeof updatedObjectInfo !== typeof undefined ) {
        // milestone
        if( task_type === '1' ) {
            var nameProp = modelObject.props.object_name.dbValues[ 0 ];
            var statusProp = modelObject.props.fnd0status.dbValues[ 0 ];
            var prgPlanDateProp = modelObject.props.start_date.dbValues[ 0 ];
            updatedObjectInfo.name = nameProp;
            updatedObjectInfo.type = 'ScheduleTask';
            updatedObjectInfo.status = statusProp;
            updatedObjectInfo.plannedDate = prgPlanDateProp;

            uidToModelObjectMap[ modelObject.uid ] = modelObject;
            uidToInfoMap[ modelObject.uid ] = updatedObjectInfo;
            stackedEventsSvc.recalculateStackedMilestones( objToDelete, updatedObjectInfo.parent, false );
        }
        // task
        else if( task_type === '0' ) {
            delete uidToInfoMap[ modelObject.uid ];
            delete uidToModelObjectMap[ modelObject.uid ];

            let deletedUid = updatedObjectInfo.uid + '__' + updatedObjectInfo.parent;
            var objToDelete = objectToDelete( deletedUid );
            var objectsToDelete = [];
            objectsToDelete.push( objToDelete );

            stackedEventsSvc.recalculateStackedMilestones( deletedUid, updatedObjectInfo.parent, true );
            //during update, if milestone become task, then it is considered as deletion from timeline
            eventBus.publish( 'removeMilestoneFromTimelineEvent', objectsToDelete );
            //eventBus.publish( 'updateSWAForEvent', ctxService.ctx.locationContext.modelObject ); //FIXME: fix delete of Event later
        }
    }
    if( task_type === '1' ) {
        let eventData = {};
        eventBus.publish( 'reloadMilestonesOnTimeline', eventData );
    }

    return updatedObjectInfo;
};

/**
 * This function will update the Timeline Data.
 *
 * @param {Object} timelines - time line infos.
 * @return {Object} timelineArray - JsArray of time line info data.
 */
var updateTimelineData = function( timelines ) {
    var timelineArray = [];
    for( var idx in timelines ) {
        if( typeof timelines[ idx ] !== typeof undefined ) {
            let timeLineObj = constructTimeline( timelines[ idx ].uid, timelines[ idx ].name, timelines[ idx ].type, timelines[ idx ].uid, timelines[ idx ].status, timelines[ idx ].objectType );
            timelineArray.push( timeLineObj );
        }
    }
    return timelineArray;
};

/**
 * This function will update the Event Data.
 *
 * @param {Object} events - event infos.
 * @return {Object} timelineArray - JsArray of event info data.
 */
var updateEventData = function( events ) {
    var timelineArray = [];
    for( var newObj in events ) {
        if( typeof events[ newObj ] !== typeof undefined ) {
            var plannedDateObj = new Date( events[ newObj ].plannedDate );
            var plannedDate = _dateTimeSvc.formatNonStandardDate( plannedDateObj,
                'yyyy-MM-dd HH:mm' );
            var forecastDateObj = null;
            if( events[ newObj ].forecastDate ) {
                forecastDateObj = new Date( events[ newObj ].forecastDate );
            }
            var forecastDate = _dateTimeSvc.formatNonStandardDate( forecastDateObj, 'yyyy-MM-dd' );
            var actualDateObj = null;
            if( events[ newObj ].actualDate ) {
                actualDateObj = new Date( events[ newObj ].actualDate );
            }
            var actualDate = _dateTimeSvc.formatNonStandardDate( actualDateObj, 'yyyy-MM-dd' );
            var timeLineObj;

            //If type is 'ScheduleTask' then construct Milestone, or else construct Event
            if( events[ newObj ].objectType === 'ScheduleTask' ) {
                timeLineObj = constructMilestone( plannedDate, 'milestone', 'Event', events[ newObj ] );
            } else {
                timeLineObj = constructEvent( plannedDate,
                    'milestone', 'Event', forecastDate, actualDate,
                    events[ newObj ] );
            }
            timelineArray.push( timeLineObj );
        }
    }
    return timelineArray;
};

/**
 * The function will invoke when we update object in timeline.
 *
 * @param {Object} eventMap - eventData.
 * @param {Data} data
 * @return {Object} dataToRefresh - updated data
 */
export let onObjectsUpdated = function( eventMap ) {
    if( eventMap ) {
        var updatedObjects = eventMap[ 'cdm.updated' ].updatedObjects;
        var timelineInfos = [];
        var eventInfos = [];
        if( updatedObjects !== null || typeof updatedObjects !== typeof undefined ) {
            for( var objIndex in updatedObjects ) {
                var type = getIntegerType( updatedObjects[ objIndex ] );
                switch ( type ) {
                    case 0:
                    case 1: {
                        var planObjectsInfo = updatePlanObjectInfo( updatedObjects[ objIndex ] );
                        timelineInfos.push( planObjectsInfo );
                        break;
                    }
                    case 4: {
                        var eventInfo = updateEventInfo( updatedObjects[ objIndex ] );
                        eventInfos.push( eventInfo );
                        timelineUtils.recalculateStackedEvents( updatedObjects[ objIndex ].uid, false );
                        eventBus.publish( 'onEventUpdation', eventInfos );
                        break;
                    }
                    case 5: {
                        var milestoneInfo = updateMilestoneInfo( updatedObjects[ objIndex ] );
                        eventInfos.push( milestoneInfo );
                        eventBus.publish( 'onEventUpdation', eventInfos );
                        break;
                    }
                    default: {
                        //
                    }
                }
            }
            var timelines = [];
            var events = [];
            if( timelineInfos.length > 0 ) {
                timelines = updateTimelineData( timelineInfos );
            }
            if( eventInfos.length > 0 ) {
                events = updateEventData( eventInfos );
            }
            return {
                timelineData: timelines,
                eventData: events
            };
        }
    }
};

/**
 * This will create the container to delete the Object
 *
 * @param {String} deletedUID - uid to delete
 */
var objectToDelete = function( deletedUID ) {
    var deleted = {};
    deleted.id = deletedUID;
    return deleted;
};

/**
 * This will construct the timeline.
 *
 * @param id The id
 * @param name The name of the element.
 * @param programType type of program.
 * @param parent parent plan uid.
 * @param state state of the element.
 * @return the time line plan object
 */
var constructTimeline = function( id, name, type, parent, state, objectType ) {
    var timeline = {};
    timeline.id = id;
    timeline.text = name;
    timeline.type = 'milestone';
    timeline.order = 1;
    timeline.open = true;
    timeline.start_date = new Date();
    timeline.finish_date = new Date();
    timeline.programType = type;
    timeline.state = state;
    timeline.objectType = objectType;
    timeline.unscheduled = true;
    timeline.render = 'split'; // To create dependency

    if( parent !== -1 ) {
        timeline.parent = parent;
    }
    return timeline;
};

/**
 * This will construct the Event.
 *
 * @param id Event UID
 * @param text name of event
 * @param startDate Planned Date of Event
 * @param taskType task type
 * @param programType Program Type
 * @param parent parent of event
 * @param color color
 * @param forecastDate Forecast Date of Event
 * @param actualDate Actual Date of Event
 * @param status status of Event
 * @param eventCode Event Code of Event
 * @return Event object
 */
var constructEvent = function( startDate, taskType, programType,
    forecastDate, actualDate, info ) {
    var task = {};
    task.id = info.uid;
    task.text = info.name;
    task.start_date = startDate;
    task.end_date = startDate;
    task.type = taskType;
    if( info.colorCode.indexOf( '#' ) === 0 ) {
        task.color = info.colorCode;
    } else {
        task.color = '#388ba6';
    }
    if( info.parent !== -1 ) {
        task.parent = info.parent;
    }
    task.programType = programType;
    task.forecastDate = forecastDate;
    task.actualDate = actualDate;
    task.status = info.status;
    task.eventCode = info.eventCode;
    for( let property in info ) {
        task[ property ] = info[ property ];
    }
    return task;
};

/**
 * This will construct the Milestone
 *
 * @param startDate Planned Date of Event
 * @param taskType task type
 * @param programType Program Type
 * @param parent parent of event
 * @param status status of Event
 * @return Event object
 */
var constructMilestone = function( startDate, taskType, programType, info ) {
    var task = {};
    task.id = info.uid + '__' + info.parent;
    task.text = info.name;
    task.start_date = startDate;
    task.end_date = startDate;
    task.type = taskType;
    task.color = '#C698B0';
    task.parent = info.parent;
    task.programType = programType;
    task.bar_height = 21;
    for( let property in info ) {
        task[ property ] = info[ property ];
    }
    return task;
};

/**
 * This function will add the milestone.
 *
 * @param {Object} event - Milestone Object.
 * @return {Object} milestone - MS Object
 */

export let addMilestone = function( event, planUid ) {
    var info = addMsInfo( event, planUid );
    var milestone;
    var milestoneType = 'milestone';
    var timelineEvent = 'Event';
    var plannedDateObj = new Date( info.plannedDate );
    var plannedDate = _dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );

    milestone = constructMilestone( plannedDate, milestoneType, timelineEvent, info );
    return milestone;
};

/**
 *
 * @param {object} milestoneObject
 * @param {object} planUid
 * @returns info object for milestone
 */
var addMsInfo = function( milestoneObject, planUid ) {
    var info;
    var objectType;
    if( milestoneObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        objectType = 'ScheduleTask';
    }
    var nameProp = milestoneObject.props.object_name.dbValues[ 0 ];
    var prgPlanDateProp = milestoneObject.props.start_date.dbValues[ 0 ];
    var status = milestoneObject.props.fnd0status.uiValues[ 0 ];

    info = {
        uid: milestoneObject.uid,
        name: nameProp,
        plannedDate: prgPlanDateProp,
        parent: planUid,
        status: status,
        objectType: objectType
    };

    uidToModelObjectMap[ milestoneObject.uid ] = milestoneObject;
    uidToInfoMap[ milestoneObject.uid ] = info;
    return info;
};

/**
 * This function will add the event.
 *
 * @param {Object} event - Event Object.
 * @return {Object} events - Events Object
 */

export let addEvent = function( event ) {
    var info = addEventInfo( event );
    var milestoneType = 'milestone';
    var timelineEvent = 'Event';
    var plannedDateObj = new Date( info.plannedDate );
    var plannedDate = _dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );
    var forecastDateObj = null;
    if( info.forecastDate ) {
        forecastDateObj = new Date( info.forecastDate );
    }
    var forecastDate = _dateTimeSvc.formatNonStandardDate( forecastDateObj, 'yyyy-MM-dd' );
    var actualDateObj = null;
    if( info.actualDate ) {
        actualDateObj = new Date( info.actualDate );
    }
    var actualDate = _dateTimeSvc.formatNonStandardDate( actualDateObj, 'yyyy-MM-dd' );

    return constructEvent( plannedDate, milestoneType, timelineEvent,
        forecastDate, actualDate, info );
};

/**
 * This function will add the configured properties in event through preference.
 *
 * @param {Object} eventObject - Event Object.
 * @param {Object} info - Event Object.
 * @param {Object} preferences - List of all the preferences.
 * @return {Object} info - Event Object to use in the timeline
 */
let getPreferenceProperties = function( eventObject, info, preferences ) {
    if( preferences ) {
        let propertyNames = ctxService.ctx.timelineContext.propertyNames;
        if( !propertyNames ) {
            propertyNames = {};
        }
        preferences.forEach( property => {
            if( eventObject.props[ property ] ) {
                let propDesc = eventObject.props[ property ].propertyDescriptor;
                let propValue = eventObject.props[ property ].dbValues[ 0 ];
                //Validation for reference and arrays
                if( propDesc.valueType !== 9 && propDesc.valueType !== 10 && !propDesc.anArray ) {
                    //If Booloean property
                    if( propDesc.valueType === 6 ) {
                        info[ property ] = { value: propValue === '1', isDate: false };
                    } else if( propDesc.valueType === 2 && propValue !== null ) {
                        //If Date property
                        var dateObj = new Date( propValue );
                        info[ property ] = { value: timelineManager.getGanttInstance().templates.tooltip_date_format( dateObj ), isDate: true };
                    } else {
                        //If String or Integer property
                        info[ property ] = { value: propValue, isDate: false };
                    }
                    propertyNames[ property ] = eventObject.props[ property ].propertyDescriptor.displayName;
                }
            }
        } );
        //Labels for tooltip properties
        ctxService.ctx.timelineContext.propertyNames = propertyNames;
    }

    return info;
};

/**
 * This will add the Event info.
 *
 * @param {Object} eventObject - eventObject
 * @return {Object} info - info related to added event.
 */

var addEventInfo = function( eventObject ) {
    var prg0PlanProp = eventObject.props.prg0PlanObject.dbValues[ 0 ];
    var nameProp = eventObject.props.object_name.dbValues[ 0 ];
    var statusProp = eventObject.props.prg0State.uiValues[ 0 ];
    var prgPlanDateProp = eventObject.props.prg0PlannedDate.dbValues[ 0 ];
    var prgForecastDateProp = eventObject.props.prg0ForecastDate.dbValues[ 0 ];
    var prgActualDateProp = eventObject.props.prg0ActualDate.dbValues[ 0 ];
    var eventColor = eventObject.props.pgp0EventColor.dbValues[ 0 ];
    var eventCodeProp = eventObject.props.prg0EventCode.dbValues[ 0 ];

    let info = {
        uid: eventObject.uid,
        name: nameProp,
        status: statusProp,
        plannedDate: prgPlanDateProp,
        forecastDate: prgForecastDateProp,
        actualDate: prgActualDateProp,
        colorCode: eventColor,
        parent: prg0PlanProp,
        eventCode: eventCodeProp
    };

    let preferences = ctxService.ctx.preferences;
    let configuredProperties = preferences.PP_Event_Information.concat( preferences.PP_Event_Tooltip_Information );
    info = getPreferenceProperties( eventObject, info, configuredProperties );

    uidToModelObjectMap[ eventObject.uid ] = eventObject;
    uidToInfoMap[ eventObject.uid ] = info;
    return info;
};

/**
 * This function will set the flag hasMoreData.
 *
 * @param {boolean} hasMore - flag to check hasMore Data.
 */
export let setHasMoreData = function( hasMore ) {
    hasMoreData = hasMore;
};

/**
 * This will add the Plan data.
 *
 * @param {Object} object - New Plan Object
 * @param {Object} rootElement - root element of tree, used to flatten the tree
 * @return {Object} info - info of the newly created Object.
 */
var addPlanInfo = function( object, rootElement ) {
    var info = getInfoFromUid( object.uid );

    if( !info ) {
        var typeProp = getIntegerType( object );
        var parentPlanProp = object.props.prg0ParentPlan.dbValues[ 0 ];
        var nameProp = object.props.object_name.dbValues[ 0 ];
        var statusProp = object.props.prg0State.uiValues[ 0 ];
        var objectTypeProp = object.props.object_type.dbValues[ 0 ];

        var parentPlanInfo = null;
        if( parentPlanProp ) {
            parentPlanInfo = addPlanInfo( _cdm.getObject( parentPlanProp ), null );
        }
        var childs = [];

        info = {
            name: nameProp,
            uid: object.uid,
            type: typeProp,
            status: statusProp,
            parent: parentPlanProp,
            children: childs,
            objectType: objectTypeProp
        };

        if( parentPlanInfo ) {
            for( var index in planObjectsInfo ) {
                if( planObjectsInfo[ index ] === parentPlanInfo.uid ) {
                    parentPlanInfo.children.push( object.uid );
                    break;
                }
            }
        }
        uidToModelObjectMap[ object.uid ] = object;
        planObjectsInfo.push( info );
        uidToInfoMap[ object.uid ] = info;
    }
    // to create flat list after filtering and regenerate tree structure after filtering is removed
    if( info ) {
        if( rootElement && info.uid !== rootElement.uid && ctxService.getCtx( 'isColumnFilteringApplied' ) ) {
            info.parent = rootElement.uid;
        } else {
            info.parent = object.props.prg0ParentPlan.dbValues[ 0 ];
        }
    }
    return info;
};

export let cleanup = function() {
    uidToInfoMap = {};
    uidToModelObjectMap = {};
    planObjectsInfo = [];
    hasMoreData = false;
    paginationStarted = false;
    selections = [];
    timelineUtils.cleanup();
    timelineEveDepService.cleanup();
    ctxService.unRegisterCtx( 'pageId' );
};

/**
/* clear the stack event data when plan navigation tree unloaded
 *
*/
export let cleanupStackEventsData = function() {
    //For StackCount
    ctxService.unRegisterCtx( 'popupContext' );
    ctxService.unRegisterCtx( 'isStackEventPanelActive' );
    ctxService.unRegisterCtx( 'isPopupOpen' );
};

export default exports = {
    clearDataProviderResults,
    buildResultString,
    checkForPsi0BOTypes,
    setInputForSelection,
    reloadTimeline,
    clearDataForHighlight,
    populateDataForHighlight,
    onEventDrag,
    deleteDependency,
    selectLink,
    unSelectLink,
    isValidLink,
    checkDuplicateDependency,
    createLink,
    callSelectTaskOnTimeline,
    showEventProperties,
    revertCtx,
    paginatePlanAndEvents,
    select,
    deSelect,
    addPlan,
    addPlanObjects,
    addEventObjects,
    onObjectsDeleted,
    onObjectsUpdated,
    addEvent,
    addMilestone,
    setHasMoreData,
    cleanup,
    cleanupStackEventsData
};
