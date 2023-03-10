// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/Saw1SchGanttDataProcessor
 */
import cmm from 'soa/kernel/clientMetaModel';
import dataSource from 'js/Saw1SchGanttDataSource';
import uiSchGanttTemplates from 'js/SMGantt/uiSchGanttTemplates';
import uiSchGanttOverrides from 'js/SMGantt/uiSchGanttOverrides';
import uiSchGanttEventHandler from 'js/SMGantt/uiSchGanttEventHandler';
import uiSchGanttUtils from 'js/SMGantt/uiSchGanttUtils';
import smConstants from 'js/ScheduleManagerConstants';
import eventBus from 'js/eventBus';
import GanttDataProcessor from 'js/GanttDataProcessor';
import schGanttUtils from 'js/SchGanttUtils';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import schNavScrollService from 'js/scheduleNavigationTreeScrollService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import ganttIntegrationService from 'js/scheduleNavigationGanttIntegrationService';

export default class Saw1SchGanttDataProcessor extends GanttDataProcessor {
    constructor() {
        super();
        this.propertyPolicyID = '';
    }

    getEventDateRanges() {
        return dataSource.instance.getAllEventDateRanges();
    }

    getDateFormat() {
        return smConstants.PROGRAM_VIEW_DATE_FORMAT;
    }

    getAllDateRanges() {
        return dataSource.instance.getAllDateRanges();
    }

    /**
     * @param {Object} dayOfWeek The day of the week. Sunday to Saturday (0-6)
     * @param {Object} range An array of ranges. A Range is a pair of start and end time of working hours. A day can have
     *            multiple ranges with breaks in-between in a working day.
     * @return {Object} The JavaScript object representation.
     */
    constructDayWorkingHours( dayOfWeek, range ) {
        var workDay = {};
        workDay.day = dayOfWeek;
        workDay.hours = range;
        return workDay;
    }


    clearAndReInitGantt() {
        schGanttUtils.clearGanttData();
        let ganttTasks = dataSource.instance.constructGanttTasks( [ dataSource.instance.getSourceScheduleSummary() ], [] );
        schGanttUtils.parseGanttData( ganttTasks, null );
    }

    initGanttCustomisations( data ) {
        uiSchGanttTemplates.addTemplates( dataSource.instance );
        uiSchGanttTemplates.addToolTipForTaskLayers();
        uiSchGanttOverrides.addOverrides( dataSource.instance );

        let ganttZoomPreference =  appCtxSvc.ctx.preferences.AWC_SM_Gantt_Zoom_Level ? appCtxSvc.ctx.preferences.AWC_SM_Gantt_Zoom_Level[ 0 ] : undefined;
        //for case when only sublocation change occurs
        var ctxGanttZoomLevel = appCtxSvc.ctx.ganttZoomLevel;
        if( ganttZoomPreference ) {
            appCtxSvc.ctx.AWC_SM_Gantt_Zoom_Level = ganttZoomPreference;
        } else if( ctxGanttZoomLevel ) {
            ganttZoomPreference = ctxGanttZoomLevel;
        } else { //Preference is not set and ctx also does not have value
            ganttZoomPreference = 'unit_of_time_measure';
        }
        this.setScaleForGantt( ganttZoomPreference, true );

        uiSchGanttEventHandler.setDataSource( dataSource.instance );
        uiSchGanttEventHandler.setSchNavTreeUtils( schNavTreeUtils );
        uiSchGanttEventHandler.setSchNavTreeScrollService( schNavScrollService );
        uiSchGanttEventHandler.registerGanttEvents( this, data );
        uiSchGanttEventHandler.registerAWEvents();
    }

    setScaleForGantt( scale, isTransformValue ) {
        uiSchGanttUtils.setGanttZoomLevel( scale, false, isTransformValue );
    }

    getGanttColumnName( colName ) {
        return smConstants.PROGRAM_VIEW_GANTT_SERVER_PROPERTY_MAPPING[ colName ];
    }

    getServerColumnName( colName ) {
        return smConstants.PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING[ colName ];
    }

    getReferenceTaskForPagination( visibleTasks ) {
        return dataSource.instance.getVisibleReferenceTask( visibleTasks );
    }

    getSummaryTasksInList( visibleTasks, parentNodeId ) {
        return dataSource.instance.getSummaryTasksInList( visibleTasks, parentNodeId );
    }

    idColumnRenderer( task ) {
        var value = '';
        value = dataSource.instance.getTaskIndex( task.id );
        return value;
    }

    predColumnRenderer( task ) {
        var value = '';
        var depInfo = dataSource.instance.getTaskPredDependencies( task.id );
        if( depInfo && depInfo.displayValues ) {
            value = depInfo.displayValues.toString();
        }
        return value;
    }

    succColumnRenderer( task ) {
        var value = '';
        var depInfo = dataSource.instance.getTaskSuccDependencies( task.id );
        if( depInfo && depInfo.displayValues ) {
            value = depInfo.displayValues.toString();
        }
        return value;
    }

    getAWColumnInfoList( colResponse, dataProvider ) {
        let columnArray = colResponse.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns;
        columnArray.forEach( col => {
            if( col.propDescriptor.propertyName === 'object_name' ) {
                col.showIcon = true;
            } else if( col.propDescriptor.propertyName === 'saw1RowNumberInGantt' ) {
                col.template = this.idColumnRenderer;
            } else if( col.propDescriptor.propertyName === 'saw1Predecessors' ) {
                col.template = this.predColumnRenderer;
            } else if( col.propDescriptor.propertyName === 'saw1Successors' ) {
                col.template = this.succColumnRenderer;
            }
        } );

        dataProvider.columnConfig = {
            columns: columnArray
        };
        return columnArray;
    }

    getConfigOptions( isShowGrid ) {
        let ganttConfig = super.getConfigOptions( isShowGrid );
        ganttConfig.readOnly = false;
        ganttConfig.order_branch = true;
        ganttConfig.order_branch_free = true;
        ganttConfig.drag_move = true;
        ganttConfig.drag_resize = true;
        //ganttConfig.drag_progress = true;
        ganttConfig.drag_links = true;
        ganttConfig.start_date = new Date( dataSource.instance.getStartDateString() );
        //Pushing start date to extra days , so that start date is not partially visible
        ganttConfig.start_date.setDate( ganttConfig.start_date.getDate() - 21 );
        ganttConfig.end_date = new Date( dataSource.instance.getEndDateString() );
        ganttConfig.bar_height = dataSource.instance.hasBaseline() ? 12 : 'full';
        ganttConfig.link_wrapper_width = dataSource.instance.hasBaseline() ? 10 : 20;
        return ganttConfig;
    }

    getActualPropFromGanttProp( ganttPropName ) {
        var name = ganttPropName;
        var updatedColName = smConstants.PROGRAM_VIEW_SERVER_GANTT_PROPERTY_MAPPING[ name ];
        if( updatedColName ) {
            name = updatedColName;
        }
        return name;
    }

    getColumnConfigId() {
        return 'Saw1GanttColumns';
    }

    deleteObjects( deletedObjectUids ) {
        schGanttUtils.removeDeletedObjectsOnGantt( deletedObjectUids );
    }

    createObjectsOnGantt( createdObjects, data ) {
        // Task creation is handled by tree table.
        let nonTaskObjects = _.filter( createdObjects, object => {
            return !cmm.isInstanceOf( 'ScheduleTask', object.modelType ) && !cmm.isInstanceOf( 'Fnd0ProxyTask', object.modelType );
        } );

        if( nonTaskObjects.length > 0 ) {
            super.createObjectsOnGantt( createdObjects, data );
        }
    }

    selectLink( taskDepUid ) {
        dataSource.instance.selectLink( taskDepUid );
        schGanttUtils.selectLink( taskDepUid );
    }

    createDependency( type, source, target ) {
        schGanttUtils.createDependency( type, source, target );
    }

    /**
     * This function will be invoked when we doube click on the link.
     *
     * @param {String} id - uid of the link.
     */
    deleteDependency( taskDepUid ) {
        let taskDep = dataSource.instance.getTaskDependency( taskDepUid );
        schGanttUtils.deleteDependency( taskDep );
    }

    isFinishDateScheduleForTask( taskUid ) {
        return schGanttUtils.isFinishDateScheduleForTask( taskUid );
    }

    onTaskDrag( id, startDate, endDate, mode ) {
        return schGanttUtils.onTaskDrag( id, startDate, endDate, mode );
    }

    onBeforeTaskReorder( srcTaskId ) {
        return schGanttUtils.onBeforeTaskReorder( srcTaskId );
    }

    onTaskReorder( srcTaskId, targetTaskId, parentId, taskIndexToMove ) {
        return schGanttUtils.onTaskReorder( srcTaskId, targetTaskId, parentId, taskIndexToMove );
    }

    getDataSource() {
        return dataSource.instance;
    }

    getSelectedTaskID() {
        return schGanttUtils.getSelectedTaskID();
    }

    getGanttChildTasks( parentId ) {
        return schGanttUtils.getGanttChildTasks( parentId );
    }

    closeGanttTask( ganttTaskId ) {
        schGanttUtils.closeGanttTask( ganttTaskId );
    }

    openGanttTask( ganttTaskId ) {
        schGanttUtils.openGanttTask( ganttTaskId );
    }

    getVisibleTasks() {
        return [];
    }

    registerEventListeners( declViewModel ) {
        let awEvents = [];

        awEvents.push( eventBus.subscribe( 'cdm.created', eventData => {
            this.createObjectsOnGantt( eventData.createdObjects, declViewModel );
        }, this ) );

        awEvents.push( eventBus.subscribe( 'cdm.deleted', eventData => {
            this.deleteObjects( eventData.deletedObjectUids );
        }, this ) );

        awEvents.push( eventBus.subscribe( 'scheduleNavigationTree.nodesAdded', eventData => {
            if( eventData.addedNodes.length > 0 ) {
                eventData.addedNodes.forEach( node => ganttIntegrationService.addNodeToGantt( node ) );
            }
        } ) );

        awEvents.push( eventBus.subscribe( 'scheduleNavigationTree.nodesRemoved', eventData => {
            if( eventData.removedNodes.length > 0 ) {
                this.deleteObjects( eventData.removedNodes.map( node => node.uid ) );
            }
        }, this ) );

        awEvents.push( eventBus.subscribe( 'scheduleNavigationTree.tasksReordered', eventData => {
            schGanttUtils.reorderTasks( eventData );
        } ) );

        awEvents.push( eventBus.subscribe( 'schGanttDataSource.addTaskLayers', eventData => {
            if( eventData.baselines.length > 0 ) {
                uiSchGanttOverrides.addTaskLayers( dataSource.instance );
            }
        } ) );

        return awEvents.concat( super.registerEventListeners( declViewModel ) );
    }

    /**
     * Returns the plugins required for Gantt widget
     * @returns Plugins for Gantt widget
     */
    getGanttPlugins() {
        return {
            critical_path: true,
            tooltip: true,
            marker: true,
            multiselect: true
        };
    }

    cleanup() {
        dataSource.instance.cleanup();
        dataSource.reset();
        uiSchGanttEventHandler.unregisterEventHandlers();
        uiSchGanttEventHandler.setDataSource( {} );
        uiSchGanttEventHandler.setSchNavTreeUtils( {} );
        uiSchGanttEventHandler.setSchNavTreeScrollService( {} );
        appCtxSvc.unRegisterCtx( 'smGanttCtx' );
    }
}
