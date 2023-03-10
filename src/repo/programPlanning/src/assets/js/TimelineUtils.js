// Copyright (c) 2022 Siemens

/**
 * @module js/TimelineUtils
 */
import _cdm from 'soa/kernel/clientDataModel';
import _cmm from 'soa/kernel/clientMetaModel';
import awFilterService from 'js/awFilterService';
import ctxService from 'js/appCtxService';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import timelineEventHandler from 'js/Timeline/uiTimelineEventHandler';
import vmcs from 'js/viewModelObjectService';
import timelineManager from 'js/uiGanttManager';
import uiTimelineUtils from 'js/Timeline/uiTimelineUtils';
import tableSvc from 'js/published/splmTablePublishedService';

var exports = {};

/**
 * Getting Last Index.
 * To update the last index of the Psi0PrgDelSearchProvider
 *
 * @param {startIndex} startIndex - startIndex of the results
 * @param {data} data - Data
 */
export let getLastIndex = function( startIndex, data ) {
    let lastIndex = 0;
    if( startIndex > 0 && data.lastEndIndex ) {
        //it's a scrolling case
        lastIndex = data.lastEndIndex.toString();
    }
    return lastIndex;
};

export let processProviderResponse = function( response, data ) {
    let searchResultsArr = [];
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if( response && response.searchResults ) {
        let delInstanceObj = {};
        for( let i = 0; i < response.searchResults.length; i++ ) {
            // Get the model object for search result object UID present in response
            let resultObject = _cdm.getObject( response.searchResults[ i ].uid );
            //If the object is not Event type , then its a Deliverable Instance
            //Set the Deliverable so as to add its properties to dummy object
            if( !_cmm.isInstanceOf( 'Prg0AbsEvent', resultObject.modelType ) ) {
                delInstanceObj = resultObject;
            } else {
                let props = [];
                let newObj = vmcs.createViewModelObject( delInstanceObj.uid );
                //Update the UID to store EventUID for highlighting the event
                newObj.uid = resultObject.uid;
                //Set Cell Properties
                let cellHeader1 = delInstanceObj.props.object_name.uiValues[ 0 ];
                props.push( String( data.i18n.objectName ) + '\\:' + cellHeader1 );
                //For objects that have item_id , it should be shown else its type should be shown
                if( delInstanceObj.props.item_id ) {
                    let cellHeader2 = delInstanceObj.props.item_id.uiValues[ 0 ];
                    props.push( String( data.i18n.ID ) + '\\:' + cellHeader2 );
                } else {
                    let cellHeader2 = '';
                    props.push( 'cellHeader2 \\:' + cellHeader2 );

                    let cellProp1 = delInstanceObj.type;
                    props.push( String( data.i18n.type ) + '\\:' + cellProp1 );
                }
                let cellProp2 = resultObject.props.object_name.uiValues[ 0 ];
                props.push( String( data.i18n.Pgp0Event ) + '\\:' + cellProp2 );

                if( props ) {
                    newObj.props.awp0CellProperties.dbValue = props;
                    newObj.props.awp0CellProperties.dbValues = props;
                    newObj.props.awp0CellProperties.uiValue = props;
                    newObj.props.awp0CellProperties.uiValues = props;
                }

                newObj.cellProperties = {};
                //Index is set to 2 as 0 and 1 are cellHeaders
                for( let idx = 2; idx < props.length; idx++ ) {
                    let keyValue = props[ idx ].split( '\\:' );
                    let key = keyValue[ 0 ];
                    let value = keyValue[ 1 ] || '';
                    newObj.cellProperties[ key ] = {
                        key: key,
                        value: value
                    };
                }
                searchResultsArr.push( newObj );
            }
        }
    }

    // Construct the output data that will contain the results
    data.totalLoaded = searchResultsArr.length;
    data.totalFound = searchResultsArr.length;
    return searchResultsArr;
};

/**
 * This function fires event on the basis of value in Timeline Find listbox.
 * @param {data} data
 */
export let getSearchByType = function( data ) {
    ctxService.registerCtx( 'timelineSearchBy', '' );
    if( data.timelineSearchBy.dbValue === 'Event' ) {
        ctxService.updateCtx( 'timelineSearchBy', 'Event' );
    } else {
        ctxService.updateCtx( 'timelineSearchBy', 'DelInstances' );
    }
    eventBus.publish( 'getEventsInformationForFilteredResult' );
};

/**
 * This function formats the planned date of event
 * @param {data} data
 */
export let formatPlannedDateForEvent = function( plannedDate ) {
    return dateTimeSvc.formatUTC( plannedDate );
};

/**
 * @param {var} id  - Id of the Event that is dragged
 * @param {date} plannedDate - New Date to be set after Event is dragged
 * @param {var} mode - The drag-and-drop Mode
 */
export let onEventDrag = function( id, plannedDate, mode ) {
    if( id ) {
        let eventObject = _cdm.getObject( id );
        let pd = new Date( plannedDate );
        if( mode === 'move' ) {
            let plannedDateProp = eventObject.props.prg0PlannedDate.dbValues[ 0 ];
            let oldPlannedDate = new Date( plannedDateProp );
            //This will read the hours and minute before drag and will assign to new date.
            //This way it will not have different hours depending on the amount of drag
            pd.setHours( oldPlannedDate.getHours() );
            pd.setMinutes( oldPlannedDate.getMinutes() );
        }
        //Formats the date to be shown in confirmation message as per user locale
        var formattedDate = awFilterService.instance( 'date' )( pd, dateTimeSvc.getSessionDateFormat() );

        let updateTasksInfo = {
            event: eventObject,
            plannedDate: pd,
            formattedDate: formattedDate
        };

        eventBus.publish( 'eventDraggedOnTimeline', updateTasksInfo );
    }
};

export let setTimelineHeight = function( ctx ) {
    var prgTimelineEle = document.getElementsByClassName( 'prgTimeline' );
    if( ctx.activeProgramBoard && prgTimelineEle ) {
        var height = timelineEventHandler.getComputedHeight();
        prgTimelineEle[ 0 ].style.height = height / 2 + 'px';
        var programBoardElement = document.getElementsByClassName( 'aw-programPlanning-programBoard' );
        if( programBoardElement && programBoardElement[ 0 ] ) {
            var prgBoard = programBoardElement[ 0 ];
            prgBoard.style.height = height / 2 - 60 + 'px';
            prgBoard.style.width = '100%';
        }
    }
};

export let updateTimelineHeight = function() {
    var prgTimelineEle = document.getElementsByClassName( 'prgTimeline' );
    if( prgTimelineEle ) {
        var height = timelineEventHandler.getComputedHeight();
        prgTimelineEle[ 0 ].style.height = height + 'px';
        timelineEventHandler.getTimelineManeger().setSizes();
        timelineEventHandler.getTimelineManeger().render();
    }
};

export let changeRowHeightForTimeline = function( eventData ) {
    if( eventData && eventData.rowHeight ) {
        timelineManager.getGanttInstance().config.row_height = eventData.rowHeight + 1;
        timelineManager.getGanttInstance().config.task_height_offset = getEventHeightOffset();
        timelineManager.getGanttInstance().render();
    }
};

export let getEventHeightOffset = function() {
    return ctxService.ctx.layout === 'compact' ? 5 : 6;
};

export let getEventHeight = function() {
    return ctxService.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW;
};

export let scrollToAndSelectEvent = function( eventObject ) {
    if( eventObject && eventObject.props.prg0PlannedDate ) {
        let plannedDate = eventObject.props.prg0PlannedDate;
        uiTimelineUtils.goToDate( plannedDate, false );
        let pinned = Boolean( ctxService.ctx.hasActivePinnedPanel );
        if( !pinned ) {
            eventBus.publish( 'selectNewlyAddedEvent', eventObject );
        }
    }
};

export let updateEventSelection = function( eventObject ) {
    if( eventObject && timelineManager.getGanttInstance().isTaskExists( eventObject.uid ) ) {
        timelineManager.getGanttInstance().selectTask( eventObject.uid );
        timelineManager.getGanttInstance().showTask( eventObject.uid );
    }
};

export default exports = {
    getLastIndex,
    processProviderResponse,
    getSearchByType,
    formatPlannedDateForEvent,
    onEventDrag,
    setTimelineHeight,
    updateTimelineHeight,
    changeRowHeightForTimeline,
    getEventHeight,
    scrollToAndSelectEvent,
    updateEventSelection,
    getEventHeightOffset
};
