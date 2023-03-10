//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/SMGantt/uiSchGanttTemplates
 */
import ganttManager from 'js/uiGanttManager';
import iconSvc from 'js/iconService';
import appCtxSvc from 'js/appCtxService';
import dateTimeSvc from 'js/dateTimeService';
import ganttConstants from 'js/SMGantt/GanttConstants';
import uiSchGanttUtils from 'js/SMGantt/uiSchGanttUtils';
import stackedEventService from 'js/SMGantt/StackedEventService';

var exports = {};

/**
 * Method for adding the template functions.
 * @param {Object} dataSource - Gantt data source.
 */
export let addTemplates = function( dataSource ) {
    ganttManager.getGanttInstance().templates.grid_folder = function( item ) {
        var icon = iconSvc.getTypeIconURL( 'ScheduleTask' );
        if( item.taskType === 1 ) {
            icon = iconSvc.getTypeIconURL( 'Milestone' );
        } else if( item.taskType === 2 ) {
            icon = iconSvc.getTypeIconURL( 'ScheduleSummaryRollupTask' );
        } else if( item.taskType === 5 ) {
            icon = iconSvc.getTypeIconURL( 'Fnd0ProxyTask' );
        } else if( item.taskType === 6 ) {
            icon = iconSvc.getTypeIconURL( 'SummaryScheduleTask' );
        }
        return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
    };

    ganttManager.getGanttInstance().templates.grid_file = function( item ) {
        var icon;
        switch ( item.taskType ) {
            case 1: //Milestone type
                icon = iconSvc.getTypeIconURL( 'Milestone' );
                break;
            case 5: //Link Task Type
                icon = iconSvc.getTypeIconURL( 'Fnd0ProxyTask' );
                break;
            case 6: //Schedule summary task type
                icon = iconSvc.getTypeIconURL( 'SummaryScheduleTask' );
                break;

            case 2: //Summary task type
                icon = iconSvc.getTypeIconURL( 'ScheduleSummaryRollupTask' );
                break;
            case 0: //Standard type
            case 3: //Phase task type
            case 4: //Gate Task type
            default: //invalid type
                icon = iconSvc.getTypeIconURL( 'ScheduleTask' );
        }
        return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
    };

    ganttManager.getGanttInstance().templates.tooltip_date_format = function( date ) {
        var formatFunc = ganttManager.getGanttInstance().date.date_to_str( '%d-%M-%Y' );
        return formatFunc( date );
    };

    ganttManager.getGanttInstance().templates.tooltip_text = function( start, end, task ) {
        var taskNameColumn = ganttManager.getGanttInstance().locale.labels.tooltip_text;
        var startDateColumn = ganttManager.getGanttInstance().locale.labels.tooltip_start_date;
        var finishDateColumn = ganttManager.getGanttInstance().locale.labels.tooltip_finish_date;
        var dateText = ganttManager.getGanttInstance().locale.labels.date;
        var statusText = ganttManager.getGanttInstance().locale.labels.status;
        var resourceText = ganttManager.getGanttInstance().locale.labels.resource;

        var tooltipText = '';
        // When Task information is viewed , tooltip to hide task related information except Resource Assignee
        if( !appCtxSvc.ctx.showGanttTaskProperties ) {
            if( task.sourceType && task.sourceType === ganttConstants.GANTT_TASK_SOURCE_TYPE_EVENT ) {
                tooltipText = '<div class="gantt_tooltip_text"><strong>' + task.text + '</strong><br/><strong>' +
                dateText + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( start ) + '<br/><strong> ' +
                statusText + ' : </strong> ' + task.status + '</br>';
                return tooltipText;
            }
            if( dataSource.hasBaseline() ) {
                tooltipText = '<div class="gantt_tooltip_text"><strong>' + task.text + '</strong><br/><strong>' +
                    statusText + ' : </strong> ' + task.fnd0status + '</br>';
            } else {
                if( task.taskType === 1 ) {
                    tooltipText = '<div class="gantt_tooltip_text"><strong>' + task.text + '</strong><br/><strong>' + dateText + ': </strong> ' +
                        ganttManager.getGanttInstance().templates.tooltip_date_format( start );
                } else {
                    tooltipText = '<div class="gantt_tooltip_text"><strong>' + task.text + '</strong><br/><strong>' +
                        startDateColumn + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( start ) + '<br/><strong> ' +
                        finishDateColumn + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( end ) + '<br/><strong>' +
                        statusText + ' : </strong> ' + task.fnd0status + '</br>';
                }
            }
        }
        // Resource assignee information to be there in tooltip , irrespective task information being viewed or not
        if( task.ResourceAssignment && task.ResourceAssignment.length > 0 ) {
            if( !tooltipText ) {
                tooltipText += '<div class=\'gantt_tooltip_resource_assignee\'>';
            }
            tooltipText += '<table><tr><td class="gantt_resource_assignee"><strong>' + resourceText + ' : </strong></td>';
            var resourceList = '';
            if( task.ResourceAssignment.length === 1 ) {
                resourceList = task.ResourceAssignment;
            } else {
                for( var i = 0; i < task.ResourceAssignment.length; i++ ) {
                    resourceList += task.ResourceAssignment[ i ] + '<br/>';
                }
            }
            tooltipText += '<td class="gantt_resource_assignee">' + '' + resourceList + '</td></tr></table>';
        }

        return tooltipText;
    };

    ganttManager.getGanttInstance().templates.task_text = function( start, end, task ) {
        let returnVal = '';
        let excludedTypes = uiSchGanttUtils.getTypesToExcludeFromTaskInformation();
        let isCurrentTaskExcluded = false;
        if(task.sourceType){
            isCurrentTaskExcluded = excludedTypes.includes(task.sourceType);
        }

        if( appCtxSvc.ctx.showGanttTaskProperties && !dataSource.hasBaseline() && !isCurrentTaskExcluded) {
            let taskStatusIcon = getTaskStatusIcon( task.taskStatusInternal );
            //For center align : Task text center aligned , Status Icon to be right aligned
            if( getTaskTextPosition( task ).taskTextPosition === 'center' ) {
                returnVal += '<div class="gantt_taskbar"><div class="gantt_task_text">' + task.text +
                    '</div><div class=\'gantt_center_align_text gantt_task_status ' + taskStatusIcon + '\'></div>';
            }
            // Task cannot fit in , check if status icon can fit
            // If Status icon fits it should be right aligned
            else if( getTaskTextPosition( task ).taskWidth >= ganttConstants.GANTT_TASK_STATUS_ICON_SIZE ) {
                returnVal += '<div class=\'gantt_task_icon_center gantt_task_status ' + taskStatusIcon + '\'</div>';
            }
        }
        return returnVal;
    };

    ganttManager.getGanttInstance().templates.rightside_text = function( start, end, task ) {
        let rightText = '';
        let excludedTypes = uiSchGanttUtils.getTypesToExcludeFromTaskInformation();
        let isCurrentTaskExcluded = false;
        if(task.sourceType){
            isCurrentTaskExcluded = excludedTypes.includes(task.sourceType);
        }
        if( appCtxSvc.ctx.showGanttTaskProperties && !isCurrentTaskExcluded ) {
            if( dataSource.hasBaseline() ) {
                //If Baseline is viewed show start date to the left
                rightText = '<div class=\'gantt_dates\'>' + dateTimeSvc.formatDate( task.end_date ) + '</div>';
            } else {
                let taskPosition = getTaskTextPosition( task ).taskTextPosition;
                if( taskPosition === 'right' ) {
                    rightText = getTaskPropertiesHtml( task );
                }
                // Resource assignee to be right placed
                if( task.ResourceAssignment && task.ResourceAssignment.length > 0 && ganttManager.getGanttInstance().config.scale_unit === 'day' ) {
                    rightText += '<div class=\'gantt_taskbar_person_icon\'></div>';
                }
                //Task end date should appear on right in all views except day
                if( ganttManager.getGanttInstance().config.scale_unit !== 'day' ) {
                    rightText += '<div class="gantt_task_date">' + dateTimeSvc.formatDate( task.end_date ) + '</div>';
                }
            }
        }
        // add stacked event information
        if (task.sourceType === "Event") {
            if (appCtxSvc.ctx.popupContext) {
               let stackedEventCountMap = appCtxSvc.ctx.popupContext.stackEventCountMap;
               let stackedTemplateText = stackedEventService.addStackedEventElementToTemplate(task, stackedEventCountMap);
               rightText += stackedTemplateText;
            }
        }
        return rightText;
    };

    ganttManager.getGanttInstance().templates.leftside_text = function( start, end, task ) {
        let leftText = '';
        let excludedTypes = uiSchGanttUtils.getTypesToExcludeFromTaskInformation();
        let isCurrentTaskExcluded = false;
        if(task.sourceType){
            isCurrentTaskExcluded = excludedTypes.includes(task.sourceType);
        }
        if( appCtxSvc.ctx.showGanttTaskProperties && !isCurrentTaskExcluded ) {
            if( dataSource.hasBaseline() ) {
                //If Baseline is viewed show end date to the right
                leftText = '<div class=\'gantt_dates\'>' + dateTimeSvc.formatDate( task.start_date ) + '</div>';
            } else {
                let taskPosition = getTaskTextPosition( task ).taskTextPosition;
                if( taskPosition === 'left' ) {
                    leftText = getTaskPropertiesHtml( task );
                }
                // Start date should appear on left in all views except day
                if( ganttManager.getGanttInstance().config.scale_unit !== 'day' ) {
                    leftText = '<div class="gantt_task_date">' + dateTimeSvc.formatDate( task.start_date ) + '</div>' + leftText;
                }
            }
        }
        return leftText;
    };

    /**
     * Get the task text position based on text width and available width on screen
     * @param {Object} task gantt task
     * @returns {Object} The task position
     */
    function getTaskTextPosition( task ) {
        let taskPos = ganttManager.getGanttInstance().getTaskPosition( task, task.start_date, task.end_date );
        let taskEndPos = ganttManager.getGanttInstance().posFromDate( task.end_date );
        let taskTextWidth = ( task.text || '' ).length * 6 + 24;
        let taskTextPosition = 'center';
        if ( taskPos.width < taskTextWidth ) {
            let ganttLastDate = ganttManager.getGanttInstance().getState().max_date;
            let ganttEndPos = ganttManager.getGanttInstance().posFromDate( ganttLastDate );
            if ( ganttEndPos - taskEndPos < taskTextWidth ) {
                taskTextPosition = 'left';
            } else {
                taskTextPosition = 'right';
            }
        }
        return {
            taskWidth: taskPos.width,
            taskTextPosition: taskTextPosition
        };
    }

    /**
     * Returns the status icon based on task status
     * @param {String} status The status of task
     * @returns {String} Icon for status
     */
    function getTaskStatusIcon( status ) {
        if ( ganttConstants.GANTT_TOOLTIP_TASK_STATUS[status] ) {
            return ganttConstants.GANTT_TOOLTIP_TASK_STATUS[status];
        }
    }

    /**
     * Render the task properties on gantt task bar
     * @param {Object} task The Gantt task
     * @returns {String} The task properties' html representation
     */
    function getTaskPropertiesHtml( task ) {
        let returnVal = '';
        let taskStatusIcon = getTaskStatusIcon( task.taskStatusInternal );
        let taskPosWidth = getTaskTextPosition( task ).taskWidth;
        let taskStatusIconInlineFlag = taskPosWidth < ganttConstants.GANTT_TASK_STATUS_ICON_SIZE;
        //Flag checks if the icon size is greater than task bar width , then the status icon and text will appear left/right
        //For Milestone status icon and text will appear left/right
        if ( taskStatusIconInlineFlag || task.taskType === 1 ) {
            returnVal += '<div class="gantt_taskbar"><div class="gantt_task_text">' + task.text +
                    '</div></div><div class=\'gantt_task_status ' + taskStatusIcon + '\'></div>';
        }
        //If task bar width is more than status icon width , then task
        else {
            returnVal += '<div class="gantt_taskbar"><div class="gantt_task_text">' + task.text + '</div></div>';
        }
        return returnVal;
    }


    ganttManager.getGanttInstance().templates.task_class = function( start, end, task ) {
        var task_classes = [];

        if( dataSource.hasBaseline() ) {
            if( appCtxSvc.ctx.layout === 'comfy' ) {
                dataSource.getBaselines().length >= 2 ? task_classes.push( 'has_baseline2' ) : task_classes.push( 'has_baseline_comfy' );
            }
            if( appCtxSvc.ctx.layout === 'compact' ) {
                dataSource.getBaselines().length >= 2 ? task_classes.push( 'has_baseline2' ) : task_classes.push( 'has_baseline_compact' );
            }
        }
        task.textColor = '#1e1e1e';
        if ( ganttManager.getGanttInstance().isCriticalTask( task ) ) {
            delete task.color;
            delete task.progressColor;
            delete task.textColor;
            task_classes.push( 'gantt_critical_task' );
        } else if( task.taskType === 1 ) { // Milestone
            task_classes.push( 'milestone' );
        } else if( task.taskType === 2 || task.taskType === 6 ) { // Schedule Summary, Summary task
            task_classes.push( 'summary_task' );
        } else if( task.taskType === 5 ) { //Proxy Task
            task_classes.push( 'proxy_task' );
        }else if ( task.sourceType === 'Event' ) {
            task_classes.push( 'event' );
        } else {
            task_classes.push( 'schedule_task' );
        }
        if( task.progress > 0 ) {
            task_classes.push( 'task_progress_border' );
        }
        if ( ganttManager.getGanttInstance().isSelectedTask( task.id ) ) {
            task_classes.push( 'gantt_selected' );
        }

        // Summary, Phase, Proxy and Schedule Summary Tasks are not draggable.
        if( task.taskType === 2 || task.taskType === 3 || task.taskType === 5 || task.taskType === 6 ) {
            task_classes.push( 'gantt_hide_start_drag' );
            task_classes.push( 'gantt_hide_finish_drag' );
        } else {
            if( dataSource.isFinishDateSchedule( task.id ) ) {
                task_classes.push( 'gantt_hide_finish_drag' );
            } else {
                task_classes.push( 'gantt_hide_start_drag' );
            }
        }
        return task_classes.join( ' ' );
    };

    //This will return the name of div when we add and modify the task in What-If mode.
    ganttManager.getGanttInstance().templates.grid_row_class = function( start, end, task ) {
        if( !ganttManager.getFlagForWhatIf() ) {
            task.whatIfMode = -1;
            task.hasWhatIfData = false;
        }
        if ( ganttManager.getGanttInstance().isSelectedTask( task.id ) ) {
            return 'gantt_selected';
        }
    };

    ganttManager.getGanttInstance().templates.link_class = function( link ) {
        var link_classes = [];

        if( ganttManager.getGanttInstance().isCriticalLink( link ) ) {
            link_classes.push( 'gantt_critical_link' );
        }

        if( dataSource.hasBaseline() ) {
            if( appCtxSvc.ctx.layout === 'comfy' ) {
                dataSource.getBaselines().length >= 2 ? link_classes.push( 'has_baseline2' ) : link_classes.push( 'has_baseline_comfy' );
            }
            if( appCtxSvc.ctx.layout === 'compact' ) {
                dataSource.getBaselines().length >= 2 ? link_classes.push( 'has_baseline2' ) : link_classes.push( 'has_baseline_compact' );
            }
        }

        if( ganttManager.getSelectedLink() === link.id ) {
            link_classes.push( 'selected_link' );
        }

        return link_classes.join( ' ' );
    };
};

// Add tooltip for baseline ( task layers like baselines)
export let addToolTipForTaskLayers = function() {

    ganttManager.getGanttInstance().ext.tooltips.tooltipFor( {
        selector: ".gantt_baseline",
        html: function( event, task ) {
            var startDateColumn = ganttManager.getGanttInstance().locale.labels.tooltip_start_date;
            var finishDateColumn = ganttManager.getGanttInstance().locale.labels.tooltip_finish_date;
            var tooltipText = '<div class="gantt_tooltip_text"><strong>' + task.baselineName + '</strong><br/><strong>' +
                startDateColumn + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( task.baselineStartDate ) + '<br/><strong> ' +
                finishDateColumn + ' : </strong> ' + ganttManager.getGanttInstance().templates.tooltip_date_format( task.baselineEndDate ) + '<br/><strong>';
            return tooltipText;
        }

    } );
};


exports = {
    addTemplates,
    addToolTipForTaskLayers
};

export default exports;
