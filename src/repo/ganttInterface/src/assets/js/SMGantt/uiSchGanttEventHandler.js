// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

'use strict';

/**
 * @module js/SMGantt/uiSchGanttEventHandler
 */
import $ from 'jquery';
import ganttManager from 'js/uiGanttManager';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import appCtx from 'js/appCtxService';
import stackedEventService from 'js/SMGantt/StackedEventService';

var exports = {};

var _events = [];
var _awEvents = [];
var _dataSource = {};
let _schNavTreeUtils = {};
let _schNavScrollService = {};

/* To store the branch index of task to move */
var taskIndexToMove;

/**
 * Adds the default events.
 */
export let registerGanttEvents = function( dataProcessor, data ) {
    //Task selection Event handlers
    var taskMultiSelectEvent = ganttManager.getGanttInstance().attachEvent( 'onMultiSelect', function( event ) {
        let clickedTaskId = ganttManager.getGanttInstance().locate( event.target );
        if( ganttManager.getGanttInstance().isTaskExists( clickedTaskId ) ) {
            let tasksList = ganttManager.getGanttInstance().getSelectedTasks();
                if( event.target && ( event.target.className === 'gantt_tree_icon gantt_open' || event.target.className === 'gantt_tree_icon gantt_close' ) && tasksList.length === 1 && appCtx.ctx
                    .mselected
                    .length === 1 && tasksList[ 0 ] === appCtx.ctx.mselected[ 0 ].uid ) {
                        //If open/close icon is clicked and the task is already selected, then do not process selection
                        return;
                }
                let  ganntObject = cdm.getObject( clickedTaskId );
                let selected = appCtx.ctx.locationContext.modelObject;
                // check for deselecting the event from gantt
                if( tasksList.length === 0  &&  ganntObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
                    eventBus.publish( 'gantt.updateSWAForEvent', [ selected ] );
                }else {
                    dataProcessor.multiSelectNode( tasksList );
                }
        }
    } );
    _events.push( taskMultiSelectEvent );
    var linkDblClickEvent = ganttManager.getGanttInstance().attachEvent( 'onLinkDblClick', function( id ) {
        return dataProcessor.deleteDependency( id );
    } );
    _events.push( linkDblClickEvent );
    var taskCreatedEvent = ganttManager.getGanttInstance().attachEvent( 'onTaskCreated', function() {
        return false;
    } );
    _events.push( taskCreatedEvent );
    var taskDeletedEvent = ganttManager.getGanttInstance().attachEvent( 'onAfterTaskDelete', function( id ) {
        dataProcessor.deselectNode( id );
    } );
    _events.push( taskDeletedEvent );
    var linkDeletedEvent = ganttManager.getGanttInstance().attachEvent( 'onAfterLinkDelete', function( id ) {
        dataProcessor.deselectNode( id );
    } );
    _events.push( linkDeletedEvent );

    var beforeTaskDragEvent = ganttManager.getGanttInstance().attachEvent( 'onBeforeTaskDrag',
        function( id, mode, e ) {
            var canDrag = false;
            var ganntObject = cdm.getObject( id );
            // Block dragging if the selected object is child of Prg0AbsEvent
            if( ganntObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
                return false;
            }
            var isFinishDateSchedule = dataProcessor.isFinishDateScheduleForTask( id );
            if( mode === 'resize' ) {
                var element = e.srcElement.className;

                if( !isFinishDateSchedule && element === 'gantt_task_drag task_right task_end_date' || isFinishDateSchedule && element === 'gantt_task_drag task_left task_start_date' ) {
                    canDrag = true;
                }
            } else {
                var taskExists = ganttManager.getGanttInstance().isTaskExists( id );
                if( taskExists === true ) {
                    var task = ganttManager.getGanttInstance().getTask( id );
                    // Allow dragging of Standard, Milestone, and Gate task type
                    if( task.taskType === 0 || task.taskType === 1 || task.taskType === 4 ) {
                        canDrag = true;
                    }
                }
            }
            return canDrag;
        } );
    _events.push( beforeTaskDragEvent );

    var onTaskDrag = ganttManager.getGanttInstance().attachEvent( 'onTaskDrag', function( id, mode, task, original ) {
        if( mode === 'resize' || mode === 'move' ) {
            ganttManager.getGanttInstance().config.awShowTooltip = 1; // This will enable the task tooltip when we drag or resize  the task.
        }
        var modes = ganttManager.getGanttInstance().config.drag_mode;
        let leftLimit = new Date( _dataSource.getStartDateString() );
        let rightLimit = new Date( _dataSource.getEndDateString() );
        if( mode === modes.move || mode === modes.resize ) {
            var diff = Number( original.end_date ) - Number( original.start_date );

            if( Number( task.end_date ) > Number( rightLimit ) ) {
                task.end_date = new Date( rightLimit );
                if( mode === modes.move ) { task.start_date = new Date( task.end_date - diff ); }
            }
            if( Number( task.start_date ) < Number( leftLimit ) ) {
                task.start_date = new Date( leftLimit );
                if( mode === modes.move ) { task.end_date = new Date( Number( task.start_date ) + diff ); }
            }
        }
    } );
    _events.push( onTaskDrag );

    var afterTaskDragEvent = ganttManager.getGanttInstance().attachEvent( 'onAfterTaskDrag', function( id, mode ) {
        var taskExists = ganttManager.getGanttInstance().isTaskExists( id );
        if( taskExists === true ) {
            var task = ganttManager.getGanttInstance().getTask( id );
            var startDate = task.start_date.toGMTString();
            var endDate = task.end_date.toGMTString();
            dataProcessor.onTaskDrag( id, startDate, endDate, mode );
        }
    } );
    _events.push( afterTaskDragEvent );

    var onRowDragStartEvent = ganttManager.getGanttInstance().attachEvent( 'onRowDragStart',
        function( id, target, e ) {
            var srcTaskExists = ganttManager.getGanttInstance().isTaskExists( id );
            if( srcTaskExists === true ) {
                return dataProcessor.onBeforeTaskReorder( id );
            }
            // return false, if source task does not exist
            return false;
        } );
    _events.push( onRowDragStartEvent );

    var onRowDragEndEvent = ganttManager.getGanttInstance().attachEvent( 'onRowDragEnd', function( id, target ) {
        var srcTaskExists = ganttManager.getGanttInstance().isTaskExists( id );
        var res = target.split( ':' );
        var targetTaskExists;
        if( res.length === 1 ) {
            targetTaskExists = ganttManager.getGanttInstance().isTaskExists( res[ 0 ] );
            target = res[ 0 ];
        } else {
            targetTaskExists = ganttManager.getGanttInstance().isTaskExists( res[ 1 ] );
            target = res[ 1 ];
        }

        if( srcTaskExists === true && targetTaskExists === true ) {
            return dataProcessor.onTaskReorder( id, target, parentId, taskIndexToMove );
        } else if( srcTaskExists === true && targetTaskExists === false ) {
            var task = ganttManager.getGanttInstance().getTask( id );
            var parentId = task.parent;
            return dataProcessor.onTaskReorder( id, target, parentId, taskIndexToMove );
        }
        // do not move the tasks if either source or target task does not exist
        return false;
    } );
    _events.push( onRowDragEndEvent );

    var onBeforeRowDragEndEvent = ganttManager.getGanttInstance().attachEvent(
        'onBeforeRowDragEnd',
        function( id, parent, tindex ) {
            taskIndexToMove = tindex;

            if( ganttManager.getGanttInstance().isTaskExists( id ) ) {
                var task = ganttManager.getGanttInstance().getTask( id );
                var targetTaskExists = ganttManager.getGanttInstance().isTaskExists( task.$drop_target );

                if( targetTaskExists ) {
                    var targetTask = ganttManager.getGanttInstance().getTask( task.$drop_target );
                    if( targetTask.taskType === 5 ) { //Proxy Task
                        eventBus.publish( 'errMsgForDragDropProxyTask', targetTask );
                        return false;
                    }
                    var dropTaskindex = ganttManager.getGanttInstance().getGlobalTaskIndex( task.$drop_target );

                    var target = cdm.getObject( task.$drop_target );

                    var targetSch = cdm.getObject( target.props.schedule_tag.dbValues[ '0' ] );
                    //Schedule Summary Task and ScheduleType is SUB
                    if( targetTask.taskType === 6 && targetSch.props.schedule_type.dbValues[ 0 ] !== 2 ||
                        dropTaskindex === 2 ) //Schedule Summary Task
                    {
                        eventBus.publish( 'errMsgForSchSummaryTask', targetTask );
                        return false;
                    }
                }
            }

            return true;
        } );
    _events.push( onBeforeRowDragEndEvent );

    var linkClickEvent = ganttManager.getGanttInstance().attachEvent( 'onLinkClick', function( id ) {
        ganttManager.getGanttInstance().unselectTask();
        return dataProcessor.selectLink( id );
    } );
    _events.push( linkClickEvent );

    var afterGridResizeEndEvent = ganttManager.getGanttInstance().attachEvent( 'onGridResizeEnd', function( old_width, new_width ) {
        var columns = ganttManager.getGanttInstance().config.columns;
        var grid_width = 0;

        columns.forEach( function( col ) {
            if( col.width < ganttManager.getGanttInstance().config.min_column_width ) {
                col.width = ganttManager.getGanttInstance().config.min_column_width;
            }
            if( col.width < col.min_width ) {
                col.width = col.min_width;
            }
            grid_width += col.width;
        } );
        ganttManager.getGanttInstance().config.columns = columns;
        if( new_width < grid_width ) {
            ganttManager.getGanttInstance().config.grid_width = grid_width;
        }
    } );
    _events.push( afterGridResizeEndEvent );

    var onBeforeLinkAdded = ganttManager.getGanttInstance().attachEvent( 'onBeforeLinkAdd', function( id, link ) {
        let taskDependencyObj = _dataSource.getTaskDependency( id );
        if( !taskDependencyObj ) {
            //go ahead and create the link.
            dataProcessor.createDependency( link.type, link.source, link.target );
            return false; //Block the Link add to the GUI.
        }
        return true; //Allows adding the link to the GUI.
    } );
    _events.push( onBeforeLinkAdded );

    var onTaskClick = ganttManager.getGanttInstance().attachEvent( 'onTaskClick', function( id, e ) {
        ganttManager.getGanttInstance().config.awShowTooltip = 1; // This will enable the task tooltip when we click on the tree area in gantt.
        return true;
    } );
    _events.push( onTaskClick );

    var onTaskSelected = ganttManager.getGanttInstance().attachEvent( 'onTaskSelected', function( id, item ) {
        let modelObject = cdm.getObject( id );
        if( modelObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ) {
            stackedEventService.processShowHidePopup( modelObject, id );
        }
    } );
    _events.push( onTaskSelected );

    var onMouseMove = ganttManager.getGanttInstance().attachEvent( 'onMouseMove', function() {
        var tooltipObject = {};
        tooltipObject = document.getElementsByClassName( 'gantt_tooltip' );
        if( typeof tooltipObject[ 0 ] !== typeof undefined ) {
            tooltipObject[ 0 ].style.opacity = ganttManager.getGanttInstance().config.awShowTooltip;
        }
    } );
    _events.push( onMouseMove );

    //--------------------------------------------------
    var onScaleClick = ganttManager.getGanttInstance().attachEvent(
        'onScaleClick',
        function( e, date ) {
            dataProcessor.setScaleForGantt( ganttManager.getGanttInstance().config.scale_unit, false );
            ganttManager.getGanttInstance().render();
            let eventData = {
                viewType: ganttManager.getGanttInstance().config.scale_unit
            };
            eventBus.publish( 'onScaleClickEvent', eventData );
        } );
    _events.push( onScaleClick );

    var onDataRender = ganttManager.getGanttInstance().attachEvent( 'onDataRender', function() {
        addTodayMarker();
    } );
    _events.push( onDataRender );

    var onGanttScroll = ganttManager.getGanttInstance().attachEvent( 'onGanttScroll', function( e, i, n, a ) {
        if ( ganttManager.getGanttInstance().config.smart_rendering ) {
            const vertScrollElement = 'div.gantt_ver_scroll';
            /*if( $( vertScrollElement ).prop( 'scrollHeight' ) > 0 && Math.floor( $( vertScrollElement ).prop( 'scrollHeight' ) -
            $( vertScrollElement ).scrollTop() ) <= $( vertScrollElement ).height()  ) {
                //This is to avoid mismatch of row and task in chart for last row while scrolling
                ganttManager.getGanttInstance().$grid_data.scrollTop = a;
            }*/
        }

        // If in Schedule Navigation sublocation, sync the tree table scroll bar.
        if( _schNavTreeUtils.isScheduleNavigationSublocation() && _schNavScrollService.isScrollSyncEnabled() ) {
            _schNavScrollService.scrollTable();
        }
    } );
    _events.push( onGanttScroll );

    var taskOpenedEvent = ganttManager.getGanttInstance().attachEvent( 'onTaskOpened', function( id ) {
        if( data.ganttOptions.isBranchPagination ) {
            dataProcessor.paginateForTaskOpened( id );
        }
        _dataSource.addPendingMockTasks( id );
    } );
    _events.push( taskOpenedEvent );

    let onBeforeTaskDisplay = ganttManager.getGanttInstance().attachEvent( 'onBeforeTaskDisplay', function( id, task ) {
        if ( task.hide_bar ) {
            return false;
     }
     return true;
  } );
  _events.push( onBeforeTaskDisplay );
};

/**
 * Method for registering an event.
 *
 * @param {object} event - The event object.
 */
export let registerEvent = function( event ) {
    _events.push( event );
};

/**
 * Registers AW generic events
 * @param timelineDataSource Instance of TimelineDataSource
 */
export let registerAWEvents = function( timelineDataSource ) {
    if( _schNavTreeUtils.isScheduleNavigationSublocation() ) {
        // Sync node toggle (open/close) actions
        _awEvents.push( eventBus.subscribe( 'scheduleNavigationTree.plTable.toggleTreeNode', function( node ) {
            if( node.isExpanded === true ) {
                ganttManager.getGanttInstance().open( node.id );
            } else {
                ganttManager.getGanttInstance().close( node.id );
            }
        } ) );

        // Listen to table scroll to sync up Gantt scroll
        _schNavScrollService.registerTable2GanttScrollSync();
    }
};

var addTodayMarker = function() {
    var date_to_str = ganttManager.getGanttInstance().date
        .date_to_str( ganttManager.getGanttInstance().config.task_date );
    var today = new Date();
    var todayMarker = {};
    todayMarker.start_date = today;
    var todayText = ganttManager.getGanttInstance().locale.labels.today;
    todayMarker.css = 'today';
    todayMarker.text = todayText;
    todayMarker.title = todayText + ': ' + date_to_str( today );
    var ganttInstance = ganttManager.getGanttInstance();
    var todayId = ganttInstance.addMarker( todayMarker );
    setInterval( function() {
        if( ganttInstance ) {
            var todayGanttMarker = ganttInstance.getMarker( todayId );
            if( todayGanttMarker ) {
                todayGanttMarker.start_date = new Date();
                todayGanttMarker.title = date_to_str( todayGanttMarker.start_date );
                ganttInstance.updateMarker( todayId );
            }
        }
    }, 1000 * 60 );
};


/**
 * Method for unregistering the events.
 *
 */
export let unregisterEventHandlers = function() {
    for( var i = 0; i < _events.length; i++ ) {
        ganttManager.getGanttInstance().detachEvent( _events[ i ] );
    }
    _events = [];

    if( _awEvents.length > 0 ) {
        for( var i = 0; i < _awEvents.length; i++ ) {
            var event = _awEvents[ i ];
            if( event ) {
                eventBus.unsubscribe( event );
            }
        }
        _awEvents = [];
    }

    // Stop listening to table scroll.
    _schNavScrollService.unRegisterTable2GanttScrollSync();
};

export let setDataSource = function( dataSource ) {
    _dataSource = dataSource;
};

export let setSchNavTreeUtils = function( schNavTreeUtils ) {
    _schNavTreeUtils = schNavTreeUtils;
};

export let setSchNavTreeScrollService = function( schNavScrollService ) {
    _schNavScrollService = schNavScrollService;
};

export default exports = {
    registerGanttEvents,
    registerEvent,
    registerAWEvents,
    unregisterEventHandlers,
    setDataSource,
    setSchNavTreeUtils,
    setSchNavTreeScrollService
};
