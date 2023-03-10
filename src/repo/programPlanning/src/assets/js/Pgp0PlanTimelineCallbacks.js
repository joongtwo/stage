// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

import _ from 'lodash';
import AwGanttCallbacks from 'js/AwGanttCallbacks';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import timelineOverrides from 'js/Pgp0PlanTimelineOverrides';
import timelineScrollService from 'js/Pgp0PlanTimelineScrollService';
import timelineTemplates from 'js/Pgp0PlanTimelineTemplates';
import AwStateService from 'js/awStateService';


export class Pgp0PlanTimelineCallbacks extends AwGanttCallbacks {
    constructor() {
        super();
        // this.schedule = schedule;
    }

    onBeforeGanttReady() {
        super.onBeforeGanttReady();
        timelineOverrides.initOverrideVariables( this.ganttInstance );
        timelineOverrides.addTimelineOverrides( this.ganttInstance );
        this.ganttInstance.templates.grid_folder = ( task ) => { return timelineTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_file = ( task ) => { return timelineTemplates.getGridIconTemplate( task ); };
        // this.ganttInstance.templates.grid_row_class = ( start, end, task ) => { return timelineTemplates.getGridRowCssClass( start, end, task ); };
        this.ganttInstance.templates.task_class = ( start, end, task ) => { return timelineTemplates.getTaskClass( task ); };
        this.ganttInstance.templates.link_class = ( link ) => { return timelineTemplates.getLinkClass( link, this.ganttInstance ); };
        this.ganttInstance.templates.task_text = ( start, end, task ) => { return timelineTemplates.getTaskText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.tooltip_date_format = ( date ) => { return this.ganttInstance.date.date_to_str( '%d-%M-%Y' )( date ); };
        this.ganttInstance.templates.tooltip_text = ( start, end, task ) => { return timelineTemplates.getTooltipText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.rightside_text = ( start, end, task ) => { return timelineTemplates.getRightSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.leftside_text = ( start, end, task ) => { return timelineTemplates.getLeftSideText( start, end, task, this.ganttInstance ); };
    }

    onGanttScroll( left, top ) {
        timelineScrollService.scrollTable();
    }

    onBeforeLinkAdd( id, link ) {
        if( cdm.getObject( id ) ) {
            return true;
        }

        var sourceObject = cdm.getObject( link.source );
        var targetObject = cdm.getObject( link.target );

        let sourceModule = 'ProgramPlanningCommandPanelsMessages';
        let localTextBundle = localeSvc.getLoadedText( sourceModule );

        if( sourceObject && targetObject ) {
            var sourceObjectType = sourceObject.modelType;
            var targetObjectType = targetObject.modelType;

            if( cmm.isInstanceOf( 'Prg0AbsEvent', sourceObjectType ) &&
                cmm.isInstanceOf( 'Prg0AbsEvent', targetObjectType ) ) {
                var sourceObjDate = new Date( sourceObject.props.prg0PlannedDate.dbValues[ 0 ] );
                var targetObjDate = new Date( targetObject.props.prg0PlannedDate.dbValues[ 0 ] );
                if( dateTimeSvc.compare( targetObjDate, sourceObjDate ) >= 0 ) {
                    var info = {
                        predTask: sourceObject,
                        succTask: targetObject
                    };
                    eventBus.publish( 'createEventDependency', info );
                } else {
                    let pastDateErrorMessage = localTextBundle.Pgp0EventDepCreateErrorMsg;
                    let finalMessage = messagingService.applyMessageParams( pastDateErrorMessage, [ '{{sourceEvent}}', '{{targetEvent}}', '{{targetEvent}}' ], {
                        sourceEvent: sourceObject.props.object_name.dbValues[ 0 ],
                        targetEvent: targetObject.props.object_name.dbValues[ 0 ]
                    } );
                    messagingService.showError( finalMessage );
                }
            }
        } else {
            //preprocessing for milestones ('milestoneUid__parentPlanUid')
            let source = link.source.split( '__' )[ 0 ];
            let target = link.target.split( '__' )[ 0 ];

            let sourceObj = cdm.getObject( source );
            let targetObj = cdm.getObject( target );

            let milestoneDepCreationErrorMessage = localTextBundle.Pgp0EventMilestoneDepCreateErrorMsg;
            let finalMessage = messagingService.applyMessageParams( milestoneDepCreationErrorMessage, [ '{{sourceEvent}}', '{{targetEvent}}' ], {
                sourceEvent: sourceObj.props.object_string.dbValues[ 0 ],
                targetEvent: targetObj.props.object_string.dbValues[ 0 ]
            } );
            messagingService.showError( finalMessage );
        }
        return false;
    }

    onLinkDblClick( id, e ) {
        let dependency = cdm.getObject( id );
        if( dependency ) {
            eventBus.publish( 'planTimelineChart.confirmDeleteOfEventDependency', { dependencyDeletes: [ dependency ] } );
        }
        eventBus.publish( 'confirmDeleteOfEventDependency' );
    }

    onBeforeTaskDrag( id, mode, e ) {
        return this.ganttInstance.getTask( id ).canDragMove();
    }

    onAfterTaskDrag( id, mode, e ) {
        handleEventDrag( id, mode, this.ganttInstance );
    }
}

// Variable to process drag(move) with mutiselect. Since 'onAfterTaskDrag' event is fired
// for each task individually, we need to accumulate and process the updateTasks call in bulk.
let multiEventUpdates = { nProcessedEvents: 0, updateEventsInfo: {} };

const handleEventDrag = ( id, mode, ganttInstance ) => {
    let tcEvent = cdm.getObject( id );
    if( tcEvent ) {
        let oldPlannedDate = new Date( tcEvent.props.prg0PlannedDate.dbValues[ 0 ] );

        let ganttEvent = ganttInstance.getTask( id );
        let dragStart = new Date( ganttEvent.start_date.toGMTString() );

        const modes = ganttInstance.config.drag_mode;
        switch ( mode ) {
            case modes.move: {
            // Init updates
                if( multiEventUpdates.nProcessedEvents === 0 ) {
                    multiEventUpdates.updateEventsInfo = { updates: [], eventObjects: [] };
                }
                ++multiEventUpdates.nProcessedEvents;

                // Skip the processed objects. DHTMLX fires one extra event for the task being dragged during multiselect.
                if( !multiEventUpdates.updateEventsInfo.eventObjects.find( object => object.uid === tcEvent.uid ) ) {
                // Read the hours and minute before drag and assign to new date, so that
                // the dates will not have different time depending on the amount of drag.
                    dragStart.setHours( oldPlannedDate.getHours() );
                    dragStart.setMinutes( oldPlannedDate.getMinutes() );

                    if( oldPlannedDate.getTime() !== dragStart.getTime() ) {
                        let eventUpdateInfo = {
                            object: tcEvent,
                            plannedDate: dateTimeSvc.formatUTC( dragStart )
                        };
                        multiEventUpdates.updateEventsInfo.updates.push( eventUpdateInfo );
                        multiEventUpdates.updateEventsInfo.eventObjects.push( tcEvent );
                    }
                }

                let nSelectedEvents = ganttInstance.getSelectedTasks().length;
                if( nSelectedEvents <= 1 ||  nSelectedEvents > 1 && multiEventUpdates.nProcessedEvents ===  nSelectedEvents + 1   ) {
                    if( multiEventUpdates.updateEventsInfo.updates.length > 0 ) {
                        eventBus.publish( 'planTimeline.eventsDragged', multiEventUpdates.updateEventsInfo );
                    }
                    // Reset updates.
                    multiEventUpdates.nProcessedEvents = 0;
                    multiEventUpdates.updateEventsInfo = {};
                }
                break;
            }
        }
    }
};

const openObject = function( taskUid ) {
    var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};
    var options = {};

    toParams.uid = taskUid;
    options.inherit = false;

    AwStateService.instance.go( showObject, toParams, options );
};

export const onWindowClick = ( e ) => {
    var target = e.target;
    if( target.className === 'gantt_tooltip_open_icon' ) {
        var taskId = target.getAttribute( 'task_id' );
        if( taskId ) {
            openObject( taskId );
        }
    }
};


const onTreeNodesLoaded = ( eventData, timelineDataService, atomicDataRef ) => {
    if( atomicDataRef.ganttChartState.getAtomicData().ganttInitialized !== true ) {
        return;
    }

    if( eventData && !_.isEmpty( eventData.treeLoadResult ) ) {
        let parentNode = eventData.treeLoadResult.parentNode;
        if( parentNode ) {
            if( eventData.treeLoadInput.isTopNode ) {
                resetGanttChart( atomicDataRef.ganttChartState.getAtomicData().ganttInstance );
            }
            eventData.treeLoadResult.childNodes && eventData.treeLoadResult.childNodes.forEach( ( node ) => {
                let nodeObject = cdm.getObject( node.uid );
                atomicDataRef.ganttChartState.getAtomicData().ganttInstance.addTask(
                    timelineDataService.constructGanttObject( nodeObject ),
                    nodeObject.props && nodeObject.props.prg0ParentPlan ? nodeObject.props.prg0ParentPlan.dbValues[ 0 ] : parentNode.uid,
                    node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
                if( node.isExpanded === true ) {
                    atomicDataRef.ganttChartState.getAtomicData().ganttInstance.open( node.uid );
                }
            } );
        }
    }
};

const resetGanttChart = ( ganttInstance ) => {
    if( ganttInstance ) {
        ganttInstance.clearAll();
    }
};

// export const onDependenciesLoaded = ( eventData, ganttDataService, atomicDataRef ) => {
//     let atomicData = atomicDataRef.ganttChartState.getAtomicData();
//     if( _.isEmpty( eventData.loadedDependencies ) || atomicData.ganttInitialized !== true ) {
//         return;
//     }
//     eventData.loadedDependencies.forEach( ( dependencyInfo ) => {
//         atomicData.ganttInstance.addLink( {
//             ...ganttDataService.constructGanttObject( cdm.getObject( dependencyInfo.uid ) ),
//             source: dependencyInfo.secondaryUid,
//             target: dependencyInfo.primaryUid
//         } );
//     } );
// };

export const onToggleTreeNode = ( node, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized === true ) {
        if( node.isExpanded === true ) {
            atomicData.ganttInstance.open( node.id );
        } else {
            atomicData.ganttInstance.close( node.id );
        }
    }
};

// export const onCollapseBelow = ( eventData, atomicDataRef ) => {
//     let atomicData = atomicDataRef.ganttChartState.getAtomicData();
//     if( atomicData.ganttInitialized === true ) {
//         atomicData.ganttInstance.close( eventData.node.id );

//         let childIds = atomicData.ganttInstance.getChildren( eventData.node.id );
//         atomicData.ganttInstance.batchUpdate( () => {
//             childIds.forEach( childId => atomicData.ganttInstance.deleteTask( childId ) );
//         } );
//     }
// };

export const onNodesAdded = ( eventData, timelineDataService, ganttInstance ) => {
    ganttInstance.batchUpdate( () => {
        eventData.addedNodes.length > 0 && eventData.addedNodes.forEach( node => {
            ganttInstance.addTask( timelineDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                node.parentNodeUid,
                node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
            let parentGanttTask = ganttInstance.getTask( node.parentNodeUid );
            if( !parentGanttTask.$open ) {
                ganttInstance.open( node.parentNodeUid );
            }
        } );
    } );
};

export const onEventsAdded = ( eventData, timelineDataService, ganttInstance ) => {
    let objectUids = [];
    ganttInstance.batchUpdate( () => {
        eventData.addedEvents.length > 0 && eventData.addedEvents.forEach( event => {
            let parentUid = event.props.prg0PlanObject.dbValues[ 0 ];
            ganttInstance.addTask( timelineDataService.constructGanttObject( cdm.getObject( event.uid ) ),
                parentUid );
            objectUids.push( event.uid );
        } );
    } );
    ganttInstance.recalculateStackedObjInfo( objectUids );
};

export const onMilestonesAdded = ( eventData, timelineDataService, ganttInstance ) => {
    if( eventData.addedMilestonesMap ) {
        let objectUids = [];
        ganttInstance.batchUpdate( () => {
            for( let planUid in eventData.addedMilestonesMap ) {
                let milestones = eventData.addedMilestonesMap[ planUid ];
                milestones && milestones.forEach( milestone => {
                    let ganttObject = timelineDataService.constructGanttObject( cdm.getObject( milestone.uid ) );
                    let updatedUid = milestone.uid + '__' + planUid;
                    objectUids.push( updatedUid );
                    ganttObject.id = updatedUid;
                    ganttInstance.addTask( ganttObject, planUid );
                } );
            }
        } );
        ganttInstance.recalculateStackedObjInfo( objectUids );
    }
};

export const onNodesRemoved = ( eventData, ganttInstance ) => {
    let parentUids = [];
    eventData.removedNodeUids.length > 0 && eventData.removedNodeUids.forEach( nodeUid => {
        if( ganttInstance.isTaskExists( nodeUid ) ) {
            let ganttTask = ganttInstance.getTask( nodeUid );
            if( parentUids.indexOf( ganttTask.parent ) === -1 ) {
                parentUids.push( ganttTask.parent );
            }
            ganttInstance.deleteTask( nodeUid );
        }
    } );
    ganttInstance.recalculateStackedObjInfoForParent( parentUids );
};

export const onPlansReordered = ( moveRequest, ganttInstance ) => {
    if( moveRequest && moveRequest.timelineMovePlanContainer && ganttInstance ) {
        ganttInstance.moveTask( moveRequest.timelineMovePlanContainer.planUid, moveRequest.timelineMovePlanContainer.index, moveRequest.timelineMovePlanContainer.parentUid );
    }
};

// export const onDependenciesAdded = ( eventData, ganttDataService, ganttInstance ) => {
//     if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
//         eventData.dependenciesInfo.forEach( depInfo => {
//             ganttInstance.addLink( { ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ), depInfo.primaryUid, depInfo.secondaryUid ) } );
//         } );
//     }
// };

export const onDependenciesDeleted = ( eventData, ganttInstance ) => {
    if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
        eventData.dependenciesInfo.forEach( depInfo => {
            ganttInstance.isLinkExists( depInfo.uid ) && ganttInstance.deleteLink( depInfo.uid );
        } );
    }
};

export const onObjectsUpdated = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }
    const objectUids = [];
    atomicData.ganttInstance.batchUpdate( () => {
        eventData.updatedObjects && eventData.updatedObjects.forEach( modelObject => {
            ganttDataService.updateGanttObject( modelObject, atomicData.ganttInstance );
            objectUids.push( modelObject.uid );
        } );
    } );
    atomicData.ganttInstance.recalculateStackedObjInfo( objectUids );
};

const getUpdateAttribute = ( propName, propValue ) => {
    return { attrName: propName, attrValue: propValue, attrType: 1 /*Unused*/ };
};

export default {
    onTreeNodesLoaded,
    onToggleTreeNode,
    onNodesAdded,
    onEventsAdded,
    onMilestonesAdded,
    onNodesRemoved,
    onObjectsUpdated,
    onPlansReordered,
    onDependenciesDeleted,
    onWindowClick
};
