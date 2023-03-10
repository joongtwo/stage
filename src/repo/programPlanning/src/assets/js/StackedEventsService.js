//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 console
 */
 'use strict';

/**
 * @module js/StackedEventsService
 */

import timelineManager from 'js/uiGanttManager';
import uiTimelineUtils from 'js/Timeline/uiTimelineUtils';
import appCtx from 'js/appCtxService';
import _cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import _cmm from 'soa/kernel/clientMetaModel';

'use strict';
var exports = {};

/**
 * Method to recalculate milestones for a plan level where milestones are deleted/updated.
 * @param {data} data
 * @param {object} object i.e. to be deleted from timeline
 * @param {string} parentPlanUid of Milestone
 * @param {boolean} actionType : true- if delete , false- if update
 */
 export let recalculateStackedMilestones = function( objectsToDelete, parentPlanUid, actionType ) {
    let mainMap = appCtx.ctx.popupContext.mapParentPlanMilestone;
    var childrenOfPlanObj = timelineManager.getGanttInstance().getChildren( parentPlanUid );
    let milestones = [];
    for( var ms = 0; ms < childrenOfPlanObj.length; ms++ ) {
        let objectUid = childrenOfPlanObj[ms];
        if ( objectUid.indexOf( '__' ) > -1 ) {
            objectUid = objectUid.substring( 0, objectUid.indexOf( '__' ) );
        }
        let timelineObject = _cdm.getObject( objectUid );
        if ( timelineObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
            milestones.push( timelineObject );
        }
    }
    if( actionType && objectsToDelete ) {
        objectsToDelete = objectsToDelete.split( '__' )[0];
        let index = _.findIndex( milestones, function( node ) {
            return node.uid === objectsToDelete;
        } );
        if( index > -1 ) {
            milestones.splice( index, 1 ); //removing the milestone i.e. converted to task
        }
    }
    if( milestones.length > 0 ) {
        milestones.sort( ( a, b ) => a.props.start_date.dbValues[ 0 ]  > b.props.start_date.dbValues[ 0 ] ? 1 : -1 );
        let milestoneMap = exports.findAdjEventAndOffsetMilestone( milestones );
        mainMap.set( parentPlanUid, milestoneMap );
        appCtx.ctx.popupContext.mapParentPlanMilestone = mainMap;
        uiTimelineUtils.findCountWithZoomeLevel( 'Milestone' );
        milestones.forEach( ( event ) => {
            timelineManager.getGanttInstance().refreshTask( event.uid + '__' + parentPlanUid );
        } );
    }
    appCtx.updateCtx( 'isPopupOpen', false );
};

/**
 *
 * @param {*} ms : array of milestones
 * @returns map of Adjacent milestones offset
 */
 export let findAdjEventAndOffsetMilestone = function( ms ) {
    let mapOfEventAndOffset = new Map();
    if( ms.length > 1 ) {
        for( let i = 1; i <= ms.length - 1; ++i ) {
            var rightEventUid = ms[i].uid;
            var leftEventUid = ms[i - 1].uid;
            var rightEventDate = new Date( ms[i].props.start_date.dbValues[0] );
            var leftEventDate = new Date( ms[i - 1].props.start_date.dbValues[0] );
            var rightDate = rightEventDate.getTime();
            var leftDate = leftEventDate.getTime();
            var offset = ( rightDate - leftDate ) / 3600000; //in hours
            mapOfEventAndOffset.set( leftEventUid, { rightEventUid, offset } );
        }
    }
    return mapOfEventAndOffset;
};

/**
 * Method to register ctx for handling stacked events on timeline
 */
 export let registerContextForStackedEvents = function() {
    let viewType = 'month';
    if( appCtx.ctx.preferences.AWC_Timeline_Zoom_Level ) {
        if( appCtx.ctx.preferences.AWC_Timeline_Zoom_Level[ 0 ] === '' ) {
            // Revisit later - replace locationContext.modelObject with opened plan object
            if( appCtx.ctx.locationContext.modelObject && appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure ) {
                viewType = uiTimelineUtils.mappingForUnitOfTimeStackCount( appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure.dbValues[ 0 ] );
            }
        } else {
            let viewTypeTest = appCtx.ctx.preferences.AWC_Timeline_Zoom_Level[ 0 ];
            if( viewTypeTest === 'unit_of_time_measure' ) {
                // Revisit later - replace locationContext.modelObject with opened plan object
                if( appCtx.ctx.locationContext.modelObject && appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure ) {
                    viewType = uiTimelineUtils.mappingForUnitOfTimeStackCount( appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure.dbValues[ 0 ] );
                }
            } else {
                viewType = viewTypeTest;
            }
        }
    }
    let popupContext = appCtx.getCtx( 'popupContext' );
    if( !popupContext ) {
        let mapParentPlanEvent = new Map();
        popupContext = {
            timelineViewType: viewType,
            stackEventCountMap: {},
            mapParentPlanEvent: mapParentPlanEvent,
            stackMilestoneCountMap: {},
            mapParentPlanMilestone: mapParentPlanEvent,
            eventsCount: 0
        };
    } else {
        popupContext.timelineViewType = viewType;
    }
    appCtx.registerCtx( 'popupContext', popupContext );
    appCtx.registerCtx( 'isStackEventPanelActive', false );
    appCtx.registerCtx( 'isPopupOpen', false );
};

export default exports = {
    findAdjEventAndOffsetMilestone,
    recalculateStackedMilestones,
    registerContextForStackedEvents
};
