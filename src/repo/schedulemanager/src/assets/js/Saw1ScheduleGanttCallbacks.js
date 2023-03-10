// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwGanttCallbacks from 'js/AwGanttCallbacks';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import ganttBaselineService from 'js/Saw1ScheduleGanttBaselineService';
import ganttLayoutService from 'js/Saw1ScheduleGanttLayoutService';
import ganttOverrides from 'js/Saw1ScheduleGanttOverrides';
import ganttScrollService from 'js/Saw1ScheduleGanttScrollService';
import ganttTemplates from 'js/Saw1ScheduleGanttTemplates';
import logger from 'js/logger';

export class Saw1ScheduleGanttCallbacks extends AwGanttCallbacks {
    constructor( schedule ) {
        super();
        this.schedule = schedule;
    }

    onBeforeGanttReady() {
        super.onBeforeGanttReady();
        ganttOverrides.initOverrideVariables( this.ganttInstance );
        ganttOverrides.addScheduleGanttOverrides( this.ganttInstance );
        this.ganttInstance.templates.grid_folder = ( task ) => { return ganttTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_file = ( task ) => { return ganttTemplates.getGridIconTemplate( task ); };
        this.ganttInstance.templates.grid_row_class = ( start, end, task ) => { return ganttTemplates.getGridRowClass( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.task_class = ( start, end, task ) => { return ganttTemplates.getTaskClass( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.link_class = ( link ) => { return ganttTemplates.getLinkClass( link, this.ganttInstance ); };
        this.ganttInstance.templates.tooltip_date_format = ( date ) => { return this.ganttInstance.date.date_to_str( '%d-%M-%Y' )( date ); };
        this.ganttInstance.templates.tooltip_text = ( start, end, task ) => { return ganttTemplates.getTooltipText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.task_text = ( start, end, task ) => { return ganttTemplates.getTaskText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.leftside_text = ( start, end, task ) => { return ganttTemplates.getLeftSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.rightside_text = ( start, end, task ) => { return ganttTemplates.getRightSideText( start, end, task, this.ganttInstance ); };
        this.ganttInstance.templates.timeline_cell_class = ( task, date ) => { return ganttTemplates.getTimelineCellClass( task, date, this.ganttInstance ); };
    }

    onGanttReady() {
        this.ganttInstance.ext.tooltips.tooltipFor( ganttBaselineService.getBaselineTooltip( this.ganttInstance ) );
    }

    onGanttScroll( left, top ) {
        ganttScrollService.scrollTable();
    }

    onBeforeLinkAdd( id, link ) {
        if( cdm.getObject( id ) ) {
            return true;
        }

        let predecessor = cdm.getObject( link.source );
        let successor = cdm.getObject( link.target );
        if( cmm.isInstanceOf( 'ScheduleTask', predecessor.modelType ) &&
            cmm.isInstanceOf( 'ScheduleTask', successor.modelType ) ) {
            let depCreateInput = {
                schedule: cdm.getObject( predecessor.props.schedule_tag.dbValues[ 0 ] ),
                newDependencies: [ {
                    predTask: predecessor,
                    succTask: successor,
                    depType: parseInt( link.type ),
                    lagTime: 0
                } ]
            };
            eventBus.publish( 'InlineDependencyCreate', depCreateInput );
        }
        return false;
    }

    onLinkDblClick( id, e ) {
        let dependency = cdm.getObject( id );
        if( dependency ) {
            eventBus.publish( 'scheduleGantt.confirmAndDeleteDependency', { schedule: this.schedule, dependencyDeletes: [ dependency ] } );
        }
    }

    onBeforeTaskDrag( id, mode, e ) {
        return this.ganttInstance.getTask( id ).canDragMove();
    }

    onAfterTaskDrag( id, mode, e ) {
        handleScheduleTaskDrag( id, mode, this.ganttInstance );
    }
}

// Variable to process drag(move) with mutiselect. Since 'onAfterTaskDrag' event is fired
// for each task individually, we need to accumulate and process the updateTasks call in bulk.
let multiTaskUpdates = { nProcessedTasks: 0, updateTasksInfo: {} };

const handleScheduleTaskDrag = ( id, mode, ganttInstance ) => {
    let tcTask = cdm.getObject( id );
    let oldStart = new Date( tcTask.props.start_date.dbValues[ 0 ] );
    let oldEnd = new Date( tcTask.props.finish_date.dbValues[ 0 ] );

    let ganttTask = ganttInstance.getTask( id );
    let dragStart = new Date( ganttTask.start_date.toGMTString() );
    let dragEnd = new Date( ganttTask.end_date.toGMTString() );

    let schedule = cdm.getObject( tcTask.props.schedule_tag.dbValues[ 0 ] );
    let isFinishDateSchedule = schedule.props.end_date_scheduling.dbValues[ 0 ];
    let isEndDateScheduling = isFinishDateSchedule === 'true' || isFinishDateSchedule === '1';

    const modes = ganttInstance.config.drag_mode;
    switch ( mode ) {
        case modes.move: {
            // Init updates
            if( multiTaskUpdates.nProcessedTasks === 0 ) {
                multiTaskUpdates.updateTasksInfo = { schedule: schedule, updates: [], taskObjects: [] };
            }
            ++( multiTaskUpdates.nProcessedTasks );

            // Skip the processed objects. DHTMLX fires one extra event for the task being dragged during multiselect.
            if( !multiTaskUpdates.updateTasksInfo.taskObjects.find( object => object.uid === tcTask.uid ) ) {
                // Read the hours and minute before drag and assign to new date, so that
                // the dates will not have different time depending on the amount of drag.
                dragStart.setHours( oldStart.getHours() );
                dragStart.setMinutes( oldStart.getMinutes() );
                dragEnd.setHours( oldEnd.getHours() );
                dragEnd.setMinutes( oldEnd.getMinutes() );

                if( oldStart.getTime() !== dragStart.getTime() || oldEnd.getTime() !== dragEnd.getTime() ) {
                    let taskUpdateInfo = {
                        object: tcTask,
                        updates: [ getUpdateAttribute( isEndDateScheduling ? 'finish_date' : 'start_date', dateTimeSvc.formatUTC( isEndDateScheduling ? dragStart : dragEnd ) ) ]
                    };
                    multiTaskUpdates.updateTasksInfo.updates.push( taskUpdateInfo );
                    multiTaskUpdates.updateTasksInfo.taskObjects.push( tcTask );
                }
            }

            let nSelectedTasks = ganttInstance.getSelectedTasks().length;
            if( nSelectedTasks <= 1 || ( nSelectedTasks > 1 && multiTaskUpdates.nProcessedTasks === ( nSelectedTasks + 1 ) ) ) {
                if( multiTaskUpdates.updateTasksInfo.updates.length > 0 ) {
                    eventBus.publish( 'scheduleGantt.tasksDragged', multiTaskUpdates.updateTasksInfo );
                }
                // Reset updates.
                multiTaskUpdates.nProcessedTasks = 0;
                multiTaskUpdates.updateTasksInfo = {};
            }
            break;
        }
        case modes.resize: {
            if( oldStart.getTime() !== dragStart.getTime() || oldEnd.getTime() !== dragEnd.getTime() ) {
                let newDate = isEndDateScheduling ? dragStart : dragEnd;

                // If the difference b/w new start & end dates is < 90 minutes, make the task as milestone,
                // by setting the start_date = end_date.
                if( parseInt( ( dragEnd.getTime() - dragStart.getTime() ) / ( 1000 * 60 ) ) < 90 ) {
                    newDate = isEndDateScheduling ? dragEnd : dragStart;
                }

                let updateTasksInfo = { schedule: schedule, updates: [ { object: tcTask, updates: [] } ], taskObjects: [ tcTask ] };
                updateTasksInfo.updates[ 0 ].updates.push( getUpdateAttribute( 'taskResized', 'true' ) );
                updateTasksInfo.updates[ 0 ].updates.push( getUpdateAttribute( isEndDateScheduling ? 'start_date' : 'finish_date', dateTimeSvc.formatUTC( newDate ) ) );
                eventBus.publish( 'scheduleGantt.tasksDragged', updateTasksInfo );
            }
            break;
        }
        case modes.progress: {
            let workComplete = ganttTask.getDbValue( 'work_estimate' ) * ganttTask.progress;
            let updateTasksInfo = { schedule: schedule, updates: [ { object: tcTask, updates: [] } ], taskObjects: [ tcTask ] };
            updateTasksInfo.updates[ 0 ].updates.push( getUpdateAttribute( 'work_complete', isNaN( workComplete ) ? '0' : workComplete.toString() ) );
            eventBus.publish( 'scheduleGantt.tasksDragged', updateTasksInfo );
            break;
        }
    }
};

/**
 * Pushes the initial data loaded in tree table to the Gantt Chart. This is done after
 * the Gantt Chart is initialized and ready to parse the data to be displayed in Gantt.
 */
export const loadInitialDataToGantt = ( treeTableData, ganttDataService, atomicDataRef, schedule, baselineUids ) => {
    let isGanttDataInited = false;
    if( treeTableData.getValue().rootNode ) {
        try {
            let rootNode = treeTableData.getValue().rootNode;
            let ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;

            ganttInstance.addTask( ganttDataService.constructGanttObject( cdm.getObject( rootNode.uid ) ) );

            // If there are no pre-selections or root node selection, scroll and show the root node.
            let selected = _.get( atomicDataRef.selectionData.getAtomicData(), 'selected', [] );
            if( selected.length <= 0 || ( selected.length === 1 && selected[0].uid === rootNode.uid ) ) {
                ganttInstance.showTask( rootNode.uid );
            }

            ganttInstance.batchUpdate( () => {
                addChildNodesToGantt( rootNode, ganttDataService, ganttInstance );

                let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
                addDependenciesToGantt( dependenciesInfo, ganttDataService, ganttInstance );
            } );

            if( baselineUids.length > 0 ) {
                ganttBaselineService.showBaselines( baselineUids, treeTableData, atomicDataRef, schedule );
            }
            isGanttDataInited = true;
        } catch ( error ) {
            logger.error( "Failed to load inital data in Gantt: ", error );
        } finally {
            // Sync the Gantt scroll bar with Tree table scroll bar position, so that
            // Gantt will scroll and display the current page and selection in Tree table.
            ganttScrollService.scrollGantt();

            // Enable synchronization of Tree Table and Gantt scroll bars.
            ganttScrollService.enableScrollSync( true );
        }
    }

    return { isGanttDataInited: isGanttDataInited };
};

/**
 * Traverses the given parent node, finds the children recursively and adds
 * to the Gantt Chart.
 *
 * @param {Object} parentNode The parent to traverse and add children.
 * @param {Object} ganttDataService The gantt data service
 * @param {Object} ganttInstance Gantt instance
 */
const addChildNodesToGantt = ( parentNode, ganttDataService, ganttInstance ) => {
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    childNodes && childNodes.forEach( ( node ) => {
        ganttInstance.addTask(
            ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
            parentNode.uid, node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
    } );

    if( parentNode.isExpanded === true ) {
        ganttInstance.getTask( parentNode.uid ).$open = true;
    }

    childNodes && childNodes.forEach( node => addChildNodesToGantt( node, ganttDataService, ganttInstance ) );
};

const addDependenciesToGantt = ( dependenciesInfo, ganttDataService, ganttInstance ) => {
    let links = [];
    !_.isEmpty( dependenciesInfo ) && dependenciesInfo.forEach( ( depInfo ) => {
        if( !ganttInstance.isTaskExists( depInfo.primaryUid ) ) {
            mockMissingTask( depInfo.primaryUid, ganttDataService, ganttInstance );
        }
        if( !ganttInstance.isTaskExists( depInfo.secondaryUid ) ) {
            mockMissingTask( depInfo.secondaryUid, ganttDataService, ganttInstance );
        }
        links.push( { ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ) ), target: depInfo.primaryUid, source: depInfo.secondaryUid } );
    } );

    if( links.length > 0 ) {
        var scrollState = ganttInstance.getScrollState();
        ganttInstance.parse( { data: [], links: links }, 'json' );
        ganttInstance.scrollTo( scrollState.x, scrollState.y );
    }
};

const mockMissingTask = ( taskUid, ganttDataService, ganttInstance ) => {
    let taskObject = cdm.getObject( taskUid );
    if( taskObject ) {
        let parentTaskUid = getParentTaskUid( taskObject );
        if( parentTaskUid && ganttInstance.isTaskExists( parentTaskUid ) ) {
            ganttInstance.addTask( ganttDataService.constructGanttObject( taskObject ), parentTaskUid );
        }
    }
};

const getParentTaskUid = ( taskObject ) => {
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', taskObject.modelType ) && taskObject.props.fnd0ref ) {
        taskObject = cdm.getObject( taskObject.props.fnd0ref.dbValues[ 0 ] );
    }
    if( taskObject && cmm.isInstanceOf( 'ScheduleTask', taskObject.modelType ) ) {
        return _.get( taskObject, 'props.fnd0ParentTask.dbValues[0]', undefined );
    }
    return undefined;
};

export const onTreeNodesLoaded = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized !== true ) {
        return;
    }

    if( eventData && !_.isEmpty( eventData.treeLoadResult ) ) {
        let parentNode = eventData.treeLoadResult.parentNode;
        // If it is top node(schedule), use the schedule summary i.e the rootPathNode that matches the 'parentElementUid''
        if( eventData.treeLoadInput.isTopNode ) {
            parentNode = _.filter( eventData.treeLoadResult.rootPathNodes, { uid: eventData.treeLoadInput.parentElementUid } )[ 0 ];
        }

        if( parentNode ) {
            if( eventData.treeLoadInput.isTopNode ) {
                resetGanttChart( atomicData.ganttInstance );
            }
            eventData.treeLoadResult.childNodes && eventData.treeLoadResult.childNodes.forEach( ( node ) => {
                if( !atomicData.ganttInstance.isTaskExists( node.uid ) ) {
                    atomicData.ganttInstance.addTask(
                        ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                        parentNode.uid,
                        node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
                } else {
                    atomicData.ganttInstance.moveTask( node.uid, node.childNdx, parentNode.uid );
                }
            } );
            if( parentNode.isExpanded === true ) {
                atomicData.ganttInstance.getTask( parentNode.uid ).$open = true;
            }
            // Load the baseline tasks for the child nodes.
            //ganttIntegrationService.loadBaselineTasksInGantt( eventData.treeLoadResult.childNodes );
        }
    }
};

const resetGanttChart = ( ganttInstance ) => {
    if( ganttInstance && ganttInstance.getTaskCount() > 0 ) {
        let links = ganttInstance.getLinks();
        let childIds = ganttInstance.getChildren( ganttInstance.getTaskByIndex( 0 ).id );

        ganttInstance.batchUpdate( () => {
            links.forEach( link => ganttInstance.isLinkExists( link.id ) && ganttInstance.deleteLink( link.id ) );
            childIds.forEach( childId => ganttInstance.isTaskExists( childId ) && ganttInstance.deleteTask( childId ) );
        } );
    }
};

export const onDependenciesLoaded = ( eventData, ganttDataService, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( _.isEmpty( eventData.loadedDependencies ) || atomicData.ganttInitialized !== true ) {
        return;
    }
    eventData.loadedDependencies.forEach( ( dependencyInfo ) => {
        if( !atomicData.ganttInstance.isLinkExists( dependencyInfo.uid ) ) {
            if( !atomicData.ganttInstance.isTaskExists( dependencyInfo.primaryUid ) ) {
                mockMissingTask( dependencyInfo.primaryUid, ganttDataService, atomicData.ganttInstance );
            }
            if( !atomicData.ganttInstance.isTaskExists( dependencyInfo.secondaryUid ) ) {
                mockMissingTask( dependencyInfo.secondaryUid, ganttDataService, atomicData.ganttInstance );
            }
            atomicData.ganttInstance.addLink( {
                ...ganttDataService.constructGanttObject( cdm.getObject( dependencyInfo.uid ) ),
                source: dependencyInfo.secondaryUid,
                target: dependencyInfo.primaryUid
            } );
        }
    } );
};

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

export const onCollapseBelow = ( eventData, atomicDataRef ) => {
    let atomicData = atomicDataRef.ganttChartState.getAtomicData();
    if( atomicData.ganttInitialized === true ) {
        atomicData.ganttInstance.close( eventData.node.id );

        let childIds = atomicData.ganttInstance.getChildren( eventData.node.id );
        atomicData.ganttInstance.batchUpdate( () => {
            childIds.forEach( childId => atomicData.ganttInstance.deleteTask( childId ) );
        } );
    }
};

export const onNodesAdded = ( eventData, ganttDataService, ganttInstance ) => {
    eventData.addedNodes.length > 0 && eventData.addedNodes.forEach( node => {
        if( ganttInstance.isTaskExists( node.uid ) ) {
            ganttInstance.moveTask( node.uid, node.childNdx, node.parentNodeUid );
        } else {
            ganttInstance.addTask( ganttDataService.constructGanttObject( cdm.getObject( node.uid ) ),
                node.parentNodeUid,
                node.childNdx ); // Insert with index to ensure mock tasks remain at the end of the list.
        }
    } );
};

export const onNodesRemoved = ( eventData, ganttInstance ) => {
    eventData.removedNodes.length > 0 && eventData.removedNodes.forEach( node => {
        ganttInstance.isTaskExists( node.uid ) && ganttInstance.deleteTask( node.uid );
    } );
};

export const onTasksReordered = ( moveRequest, ganttInstance ) => {
    if( moveRequest && ganttInstance ) {
        let srcTaskId = moveRequest.task.uid;
        if( moveRequest.prevSibling && moveRequest.prevSibling.uid ) {
            let prevSibling = cdm.getObject( moveRequest.prevSibling.uid );
            if( prevSibling ) {
                let srcTaskIndex = ganttInstance.getTaskIndex( srcTaskId );
                let prevSiblingIndex = ganttInstance.getTaskIndex( moveRequest.prevSibling.uid );
                let insertIndex = srcTaskIndex > prevSiblingIndex ? prevSiblingIndex + 1 : prevSiblingIndex;
                ganttInstance.moveTask( srcTaskId, insertIndex, moveRequest.newParent.uid );
            }
        }
        ganttInstance.updateTask( srcTaskId );
    }
};

export const onDependenciesAdded = ( eventData, ganttDataService, ganttInstance ) => {
    if( eventData && eventData.dependenciesInfo && eventData.dependenciesInfo.length > 0 ) {
        eventData.dependenciesInfo.forEach( depInfo => {
            if( !ganttInstance.isLinkExists( depInfo.uid ) ) {
                ganttInstance.addLink( {
                    ...ganttDataService.constructGanttObject( cdm.getObject( depInfo.uid ) ),
                    source: depInfo.secondaryUid,
                    target: depInfo.primaryUid
                } );
            }
        } );
    }
};

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
    eventData.updatedObjects && eventData.updatedObjects.forEach( modelObject => ganttDataService.updateGanttObject( modelObject, atomicData.ganttInstance ) );
};

const getUpdateAttribute = ( propName, propValue ) => {
    return { attrName: propName, attrValue: propValue, attrType: 1 /*Unused*/ };
};

export default {
    loadInitialDataToGantt,
    onTreeNodesLoaded,
    onDependenciesLoaded,
    onToggleTreeNode,
    onCollapseBelow,
    onNodesAdded,
    onNodesRemoved,
    onTasksReordered,
    onDependenciesAdded,
    onDependenciesDeleted,
    onObjectsUpdated
};
