//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/TimelineEventDependencyService
 */

import _cmm from 'soa/kernel/clientMetaModel';
import _cdm from 'soa/kernel/clientDataModel';
import constantsService from 'soa/constantsService';
import ctxService from 'js/appCtxService';
import dateTimeService from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import timelineManager from 'js/uiGanttManager';
import timelineUtils from 'js/Timeline/uiTimelineUtils';
import _ from 'lodash';
import selectionSvc from 'js/selection.service';
import prgtimelineUtils from 'js/Timeline/prgTimelineUtils';

'use strict';

var exports = {};

/**
 * uid to the Dependency Map.
 */
var uid2DependencyMap = {};

/**
 * uid to the Primary event to Secondary Event Map.
 */
var uid2EventPrimarySecondaryMap = {};

/**
 * The Link info list.
 */
var _links = [];

/**
 * Function to create event dependency link information from SOA response
 *
 * @param {Object} response - SOA response
 */
export let processEventLinksInfo = function( response ) {
    var linkObjects = [];
    for( var i = 0; i < response.output.length; i++ ) {
        var output = response.output[ i ];
        var relationshipObjects = output.relationshipData[ 0 ].relationshipObjects;
        if( relationshipObjects.length > 0 ) {
            for( var index = 0; index < relationshipObjects.length; index++ ) {
                var linkObj = relationshipObjects[ index ].relation;
                linkObjects.push( linkObj );
            }
        }
    }
    addAndRenderDependencies( linkObjects );
};

/**
 * This function will add the dependency information to dependency map.
 * After updating the dependency map it will also render the links on the widget.
 *
 * @param {Object} linkObjects - event dependency objects
 */
var addAndRenderDependencies = function( linkObjects ) {
    if( linkObjects !== null && linkObjects.length > 0 ) {
        var linkObjs = [];
        linkObjects.forEach( function( link ) {
            //Process the dependency
            var linkObj = exports.addLinkInfo( link );
            linkObjs.push( linkObj );
        } );
    }
    timelineUtils.addCreatedObjectsOnTimeline( null, linkObjs );
};

/**
 * This function will set the Event Dependencies flag to true
 * It will then be used to show event Dependencies in Timeline view
 */
export let showHideEventDependencies = function() {
    timelineManager.getGanttInstance().config.show_links = !ctxService.ctx.showHideEventDependencyFlag;
    ctxService.registerCtx( 'showHideEventDependencyFlag', !ctxService.ctx.showHideEventDependencyFlag );
    /* If the toggle is ON then:
        1. Fetch the existing dependencies and render them.
        2. Allow to create dependency
    */
    if( ctxService.ctx.showHideEventDependencyFlag && timelineUtils.getEventsFromTimeLine().length > 0 ) {
        //Hide event info when dependency command button is toggle on
        ctxService.registerCtx( 'showEventProperties', false );
        timelineManager.getGanttInstance().config.drag_links = ctxService.ctx.showHideEventDependencyFlag;
        eventBus.publish( 'processedEventsInfo', timelineUtils.getEventsFromTimeLine() );
    }
    timelineManager.getGanttInstance().render();
};

/**
 * This function will add the link.
 *
 * @param {Object} linkInfo - The info of the link.
 */
var addLink = function( linkInfo ) {
    if( _links.indexOf( linkInfo ) < 0 ) {
        _links.push( linkInfo );
    }
};

/**
 * This function will check if the link is valid or not.
 *
 * @param {String} id - uid of the link.
 * @return {Boolean} isValid - flag that will decide the validity of the link.
 */
export let isValidLink = function( id ) {
    var isValid = false;
    if( id && uid2DependencyMap[ id ] ) {
        isValid = true;
    }
    return isValid;
};

/**
 * This function will check for duplicate dependencies and will give error message if exists.
 *
 * @param {Object} source - Source Object
 * @param {Object} target - target Object.
 */
export let checkDuplicateDependency = function( source, target ) {
    let isValidDependency = true;
    let duplicateDependency = _links.filter( link => link.source === source && link.target === target );
    if( duplicateDependency.length > 0 ) {
        isValidDependency = false;
    }
    if( !isValidDependency ) {
        let sourceObject = _cdm.getObject( source );
        let targetObject = _cdm.getObject( target );
        if( sourceObject && targetObject ) {
            let sourceModule = 'ProgramPlanningCommandPanelsMessages';
            let localTextBundle = localeSvc.getLoadedText( sourceModule );
            let milestoneDepCreationErrorMessage = localTextBundle.Pgp0DuplicateDependencyErrorMsg;
            let finalMessage = messagingService.applyMessageParams( milestoneDepCreationErrorMessage, [ '{{sourceEvent}}', '{{targetEvent}}' ], {
                sourceEvent: sourceObject.props.object_name.dbValues[ 0 ],
                targetEvent: targetObject.props.object_name.dbValues[ 0 ]
            } );
            messagingService.showError( finalMessage );
        }
    }
    return isValidDependency;
};

export let renderEventDependency = function( data ) {
    //To handle event dependency scenario
    if( data && data.serviceData && data.serviceData.updated[ 0 ] ) {
        let updatedObj = _cdm.getObject( data.serviceData.updated[ 0 ] );
        let linkInfo = _cdm.getObject( data.createdRelationObject.uid );
        getEventLink( updatedObj, linkInfo, data );
    }
};

/**
 * This function will get the dependency associated with the Event.
 *
 * @param {Object} updatedObject - Updated Object
 * @param {Object} dependency - dependency link object
 * @param {Object} data - data object containing dependency information
 */
var getEventLink = function( updatedObject, dependency, data ) {
    let linkInfo;
    if( updatedObject ) {
        var sourceObjects = updatedObject.props.Prg0EventDependencyRel.dbValues;
        if( !_.isEmpty( data.eventMap.linkCreatedViaDrag ) ) {
            var sourceIndex = sourceObjects.indexOf( data.eventMap.linkCreatedViaDrag.predTask.uid );
            linkInfo = exports.addLinkInfo( updatedObject, dependency, sourceIndex );
        }
    }
    if( linkInfo ) {
        if( !timelineManager.getGanttInstance().isLinkExists( linkInfo.id ) ) {
            timelineManager.getGanttInstance().addLink( linkInfo );
        }
    }
    if( linkInfo && linkInfo.source ) {
        let sourceObject = _cdm.getObject( linkInfo.source );
        if( sourceObject && sourceObject.props.prg0PlannedDate.dbValues[ 0 ] ) {
            let position = timelineManager.getGanttInstance().posFromDate( new Date( sourceObject.props.prg0PlannedDate.dbValues[ 0 ] ) ); //settig the leftmost position of timeline as the date
            if( position ) {
                timelineManager.getGanttInstance().scrollTo( position ); //scrolling to the position set
            }
        }
    }
};

/**
 * @param {Object} updatedEventObject - Event object containing dependency related information
 * In case of new dependency creation , it holds the secondary event object which has the relation props set.
 * In case of rendering the dependency , it is Dependency object which has Primary object , Secondary object and link id details.
 * @param {Object} dependency - In case of new dependency creation , it holds the dependency object's details.
 * @param {Integer} sourceIndex - Index of the source event object
 * @return {Object} linkInfo - The GanttLink info if resolved. The link is resolved if both predecessor and
 *         successor are found.
 */
export let addLinkInfo = function( updatedEventObject, dependency, sourceIndex ) {
    var source;
    var target;
    var dependencyId;
    if( !_.isEmpty( updatedEventObject ) ) {
        if( !_.isEmpty( dependency ) ) {
            source = updatedEventObject.props.Prg0EventDependencyRel.dbValues[ sourceIndex ];
            target = updatedEventObject.uid;
            dependencyId = dependency.uid;
            uid2DependencyMap[ dependencyId ] = dependency;
        } else {
            source = updatedEventObject.props.secondary_object.dbValues[ 0 ];
            target = updatedEventObject.props.primary_object.dbValues[ 0 ];
            dependencyId = updatedEventObject.uid;
            uid2DependencyMap[ dependencyId ] = updatedEventObject;
        }

        var linkInfo = {
            id: dependencyId,
            source: source,
            target: target,
            type: 0
        };
        addLink( linkInfo );

        return linkInfo;
    }
};

/**
 *
 * @param {object} data - Contains the data of the Event and its new date
 * This functions formats the date
 *
 */
export let formatNewEventDate = function( Pgp0NewPlannedDate, eventData, eventObj ) {
    var dateValue;
    //When reading the new date from Shift Event panel
    if( Pgp0NewPlannedDate && Pgp0NewPlannedDate.dbValue ) {
        if( eventObj.props.prg0PlannedDate ) {
            let plannedDate = new Date( eventObj.props.prg0PlannedDate.dbValues[ 0 ] );
            let newPlannedDate = new Date( Pgp0NewPlannedDate.displayValues[ 0 ] );
            //Setting the time from old date to new date
            newPlannedDate.setHours( plannedDate.getHours() );
            newPlannedDate.setMinutes( plannedDate.getMinutes() );
            dateValue = dateTimeService.formatUTC( newPlannedDate );
        }
    }
    //When event is dragged on Timeline while secondary events are present
    else if( eventData.plannedDate ) {
        dateValue = dateTimeService.formatUTC( eventData.plannedDate );
    }
    //When event is dragged on Timeline while no secondary events are present
    else if( eventData.updateTaskInfo.plannedDate ) {
        dateValue = dateTimeService.formatUTC( eventData.updateTaskInfo.plannedDate );
    }
    return dateValue;
};

/**
 *
 * @param {object} data - Contains the data for the event to be moved
 * This function prepares the input for the SOA
 *
 */
export let prepareInputEvents = function( data ) {
    var eventInput = [];
    var eventInfo = {};
    //When event is dragged on Timeline while secondary events are present
    if( !_.isEmpty( data.eventData.updateTaskInfo ) ) {
        eventInfo = data.eventData.updateTaskInfo;
    }
    //When event is dragged on Timeline while secondary events are present
    else if( !_.isEmpty( data.eventData && data.eventData.event ) ) {
        eventInfo = data.eventData;
    }
    eventInfo = {
        type: eventInfo.event.type,
        uid: eventInfo.event.uid
    };
    eventInput.push( eventInfo );
    return eventInput;
};

/**
 *
 * @param {data} data - Contains value set in the shift event panel
 * This functions returns the checkbox value from Shift Event Panel
 * If checkbox is not visible , then set nothing
 */
export let setUpdateSecondaryEvents = function( Pgp0ShiftSecondary ) {
    //If event has secondary events then returns the value set in the checkbox
    if( Pgp0ShiftSecondary ) {
        return Pgp0ShiftSecondary.dbValue;
    }
    //If event has no secondary events then return empty and read from BO Constant
    return;
};

/**
 *
 * @param {object} eventdata - It contains the information to update the event's date
 * @param {boolean} isUpdateSecondaryEvent - Flag that determines whether to update secondary events or not
 * The function sets the update secondary events to true/false based on User confirmation yes/no.
 *
 */
export let setUpdateSecondaryEventFlag = function( eventData, isUpdateSecondaryEvent ) {
    var updateTaskInfo = eventData.updateTaskInfo;
    updateTaskInfo.updateSecondaryEvents = isUpdateSecondaryEvent;
    eventBus.publish( 'callMoveEventSOA', updateTaskInfo );
};

/**
 * Method for getting Event dependency Link Object
 * @param {Object} dependencyId - selected dependency link id
 * @returns {Object} Dependency link object
 */
export let getEventDependency = function( dependencyId ) {
    return uid2DependencyMap[ dependencyId ];
};

/**
 * Warning message for delete event dependency.
 * @param {Object} dependencyToDelete - selected dependency link object
 */
export let deleteEventDependency = function( dependencyToDelete ) {
    if( !dependencyToDelete ) {
        return;
    }
    var secondaryEventNameString;
    var primaryEventNameString;
    if( dependencyToDelete.props.primary_object && dependencyToDelete.props.secondary_object ) {
        secondaryEventNameString = dependencyToDelete.props.secondary_object.uiValues[ 0 ];
        primaryEventNameString = dependencyToDelete.props.primary_object.uiValues[ 0 ];
    } else {
        for( var i = 0; i < _links.length; i++ ) {
            if( _links[ i ].id === dependencyToDelete.uid ) {
                var sourceObject = _cdm.getObject( _links[ i ].source );
                var targetObject = _cdm.getObject( _links[ i ].target );
                if( sourceObject && targetObject ) {
                    secondaryEventNameString = sourceObject.props.object_name.dbValues[ 0 ];
                    primaryEventNameString = targetObject.props.object_name.dbValues[ 0 ];
                }
            }
        }
    }
    var selectedObj = ctxService.getCtx( 'selected' );
    if( secondaryEventNameString && primaryEventNameString && selectedObj &&
        selectedObj.modelType.typeHierarchyArray.indexOf( 'Prg0EventDependencyRel' ) > -1 ) {
        var messageParams = {
            secondaryEventName: secondaryEventNameString,
            primaryEventName: primaryEventNameString
        };
        eventBus.publish( 'warningMessageForDeletingEventDependency', messageParams );
    }
};

/**
 * Prepares the inputs for deleteEventDependency.
 * @param {Object} dependencyId - selected dependency link id
 */
export let deleteDependency = function( dependencyId ) {
    let eventDep = getEventDependency( dependencyId );
    if( eventDep ) {
        deleteEventDependency( eventDep );
    }
};

/**
 * Method for unselect the dependency Link
 */
export let unSelectLink = function() {
    timelineManager.setSelectedLink( null );
    selectionSvc.updateSelection( ctxService.ctx.locationContext.modelObject, ctxService.ctx.locationContext.modelObject );
};

/**
 * Method checks for the BO Constant's Value(Prg0MaintainGapForRelatedEvents)
 * If the BO Constant is present in the cache , then it returns its value.
 * If the BO Constant is not present , then it gets the constant's value and then adds it to the cache to be read at later stage.
 * @param {object} shiftSecondary - Shift Secondary events checkbox on the Shift Event panel
 *
 */
export let checkAndSetBOConstantValue = function( ctx, shiftSecondary ) {
    var typeName = ctx.mselected[ 0 ].modelType.name;
    var constantName = 'Prg0MaintainGapForRelatedEvents';
    //Check if cache contains the value of the BO Constant
    var boConstantValue = constantsService.getConstantValue( typeName, constantName );
    var newPgp0ShiftSecondary = _.clone( shiftSecondary );
    //If BO Constant value is not cached , then make the call to get the value
    if( boConstantValue === null ) {
        var getBOConstantValue = [];
        getBOConstantValue.push( {
            typeName: typeName,
            constantName: constantName
        } );
        constantsService.getTypeConstantValues( getBOConstantValue ).then( function( response ) {
            if( response && response.constantValues && response.constantValues.length > 0 ) {
                boConstantValue = response.constantValues[ 0 ].value;
                newPgp0ShiftSecondary.dbValue = stringToBool( boConstantValue );
            }
        } );
    } else {
        newPgp0ShiftSecondary.dbValue = stringToBool( boConstantValue );
    }
    return newPgp0ShiftSecondary;
};

var stringToBool = function( constantValue ) {
    if( constantValue === 'true' ) {
        return true;
    } else if( constantValue === 'false' ) {
        return false;
    }
};

export let cleanup = function() {
    uid2DependencyMap = {};
    _links.splice( 0, _links.length );
};

export default exports = {
    prepareInputEvents,
    checkAndSetBOConstantValue,
    setUpdateSecondaryEventFlag,
    setUpdateSecondaryEvents,
    formatNewEventDate,
    renderEventDependency,
    addLinkInfo,
    isValidLink,
    checkDuplicateDependency,
    processEventLinksInfo,
    showHideEventDependencies,
    getEventDependency,
    deleteDependency,
    deleteEventDependency,
    unSelectLink,
    cleanup
};
