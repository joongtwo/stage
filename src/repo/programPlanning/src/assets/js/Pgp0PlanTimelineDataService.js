// Copyright (c) 2022 Siemens

import appCtx from 'js/appCtxService';
import ganttDataService, { AwGanttDataService } from 'js/AwGanttDataService';
import dateTimeSvc from 'js/dateTimeService';

/**
 * Schedule Timeline data transform service
 */
export default class Pgp0PlanTimelineDataService extends AwGanttDataService {
    constructor() {
        super();
        this.createFnMap = new Map( [
            [ 'Prg0AbsPlan', Pgp0PlanTimelineDataService.programPlanCreateFn ],
            [ 'Prg0AbsEvent', Pgp0PlanTimelineDataService.programEventCreateFn ],
            [ 'Prg0EventDependencyRel', Pgp0PlanTimelineDataService.programEventDependencyCreateFn ],
            [ 'ScheduleTask', Pgp0PlanTimelineDataService.scheduleTaskCreateFn ]
        ] );

        this.updateFnMap = new Map( [
            [ 'Prg0AbsEvent', Pgp0PlanTimelineDataService.programEventUpdateFn ]
        ] );
    }

    static programPlanCreateFn( modelObject ) {
        let ganttObject = ganttDataService.createGanttObject( modelObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.render = 'split';
        ganttObject.unscheduled = true;
        return ganttObject;
    }

    static programEventCreateFn( eventObject ) {
        let plannedDateStr = eventObject.props.prg0PlannedDate.dbValues[ 0 ];
        let plannedDateObj = new Date( plannedDateStr );
        let plannedDate = dateTimeSvc.formatNonStandardDate( plannedDateObj, 'yyyy-MM-dd HH:mm' );
        let ganttObject = ganttDataService.createGanttObject( eventObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = plannedDate;
        ganttObject.end_date = plannedDate;
        ganttObject.type = 'milestone';
        ganttObject.getCssClass = () => { return 'event'; };
        ganttObject.color = ganttObject.getDbValue( 'pgp0EventColor' );
        ganttObject.getLeftSideText = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventLeftSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideText = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventRightSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getLeftSideValue = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventLeftSideValue( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideValue = ( start, end, ganttTask, ganttInstance ) => { return getPlanEventRightSideValue( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getEventTooltip( start, end, ganttTask, ganttInstance ); };
        ganttObject.isBubbleCountSupported = () => { return true; };
        ganttObject.canDragMove = () => { return true; };
        let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
        let eventTooltipPreference = appCtx.getCtx( 'preferences.PP_Event_Tooltip_Information' );
        let configuredProperties = eventInfoPreference.concat( eventTooltipPreference );
        configuredProperties.push( 'prg0State' );
        configuredProperties && configuredProperties.forEach( ( prefPropety ) => ganttObject[ prefPropety ] = ganttObject.getDbValue( prefPropety ) );
        return ganttObject;
    }

    static scheduleTaskCreateFn( schTaskObject ) {
        let ganttObject = ganttDataService.createGanttObject( schTaskObject.uid );
        ganttObject.text = ganttObject.getUiValue( 'object_string' );
        ganttObject.start_date = new Date( schTaskObject.props.start_date.dbValues[ 0 ] );
        ganttObject.end_date = new Date( schTaskObject.props.finish_date.dbValues[ 0 ] );
        ganttObject.type = 'milestone';
        ganttObject.fnd0StatusUiValue = ganttObject.getUiValue( 'fnd0status' );
        ganttObject.isBubbleCountSupported = () => { return true; };
        ganttObject.getCssClass = () => { return 'milestone'; };
        ganttObject.getLeftSideText = ( start, end, ganttTask, ganttInstance ) => { return getMilestoneLeftSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getRightSideText = ( start, end, ganttTask, ganttInstance ) => { return getMilestoneRightSideText( start, end, ganttTask, ganttInstance ); };
        ganttObject.getTooltipText = ( start, end, ganttTask, ganttInstance ) => { return getMilestoneTooltipText( start, end, ganttTask, ganttInstance ); };

        return ganttObject;
    }

    static programEventDependencyCreateFn( eventDepObject ) {
        let ganttObject = ganttDataService.createGanttObject( eventDepObject.uid );
        ganttObject.source = ganttObject.getDbValue( 'secondary_object' );
        ganttObject.target = ganttObject.getDbValue( 'primary_object' );
        ganttObject.type = '0';
        return ganttObject;
    }

    static programEventUpdateFn( modelObject, ganttInstance ) {
        if( ganttInstance.isTaskExists( modelObject.uid ) ) {
            let ganttObject = ganttInstance.getTask( modelObject.uid );
            ganttObject.text = ganttObject.getUiValue( 'object_string' );
            ganttObject.start_date = new Date( ganttObject.getDbValue( 'prg0PlannedDate' ) );
            ganttObject.end_date = new Date( ganttObject.getDbValue( 'prg0PlannedDate' ) );
            ganttObject.color = ganttObject.getDbValue( 'pgp0EventColor' );
            ganttInstance.updateTask( ganttObject.id );
        }
    }
}

const canShowTaskText = ( ganttInstance ) => {
    return ganttInstance.showEventProperties === 'true';
};

function isValidDate( date ) {
    return date && Object.prototype.toString.call( date ) === '[object Date]' && !isNaN( date );
}

const getPlanEventLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) || ganttTask.showLeftText !== true ) {
        return;
    }

    let taskText = [];
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 0 ] ) {
        const prefProperty = eventInfoPreference[ 0 ];
        let propValue = ganttTask[ prefProperty ];
        let dateObj = new Date( propValue );
        if( isValidDate( dateObj ) ) {
            if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                propValue = dateTimeSvc.formatDate( date );
                taskText.push( '<div class="gantt_task_date">' + propValue + '</div>' );
            }
        } else {
            taskText.push( '<div class="gantt_task_text">' + propValue + '</div>' );
        }
    }
    return taskText.join( '' );
};

const getPlanEventRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    let taskText = [];
    if( ganttTask.getStackedObjectsUids().length > 1 ) {
        let layout = appCtx.getCtx( 'layout' );
        taskText.push( '<div class="gantt_task_stackedInfo ' + layout + '"><div class="gantt_task_stackedCount">' + ganttTask.getStackedObjectsUids().length + '</div></div>' );
    }
    if( !canShowTaskText( ganttInstance ) || ganttTask.showRightText !== true ) {
        return taskText.join( '' );
    }
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 1 ] ) {
        const prefProperty = eventInfoPreference[ 1 ];
        let propValue = ganttTask[ prefProperty ];
        let dateObj = new Date( propValue );
        if( isValidDate( dateObj ) ) {
            if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                propValue = dateTimeSvc.formatDate( date );
                taskText.push( '<div class="gantt_task_date">' + propValue + '</div>' );
            }
        } else {
            taskText.push( '<div class="gantt_task_text">' + propValue + '</div>' );
        }
    }
    return taskText.join( '' );
};

const getPlanEventLeftSideValue = ( start, end, ganttTask, ganttInstance ) => {
    let propValue = '';
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 0 ] ) {
        const prefProperty = eventInfoPreference[ 0 ];
        propValue = ganttTask[ prefProperty ];
        let dateObj = new Date( propValue );
        if( isValidDate( dateObj ) ) {
            if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                propValue = dateTimeSvc.formatDate( date );
            }
        }
    }
    return propValue;
};

const getPlanEventRightSideValue = ( start, end, ganttTask, ganttInstance ) => {
    let propValue = '';
    let eventInfoPreference = appCtx.getCtx( 'preferences.PP_Event_Information' );
    if( eventInfoPreference && eventInfoPreference[ 1 ] ) {
        const prefProperty = eventInfoPreference[ 1 ];
        propValue = ganttTask[ prefProperty ];
        let dateObj = new Date( propValue );
        if( isValidDate( dateObj ) ) {
            if( prefProperty !== 'prg0PlannedDate' || !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
                let date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                propValue = dateTimeSvc.formatDate( date );
            }
        }
    }
    return propValue;
};

const getMilestoneLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) || ganttTask.showLeftText !== true ) {
        return;
    }
    let PlannedDateObj = new Date( ganttTask.start_date );
    let milestonePlannedDate = dateTimeSvc.formatNonStandardDate( PlannedDateObj, 'yyyy-MM-dd' );
    let leftText = [];
    leftText.push( '<div class="gantt_task_date">' + dateTimeSvc.formatDate( milestonePlannedDate ) + '</div>' );
    return leftText.join( '' );
};

const getMilestoneRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTaskText( ganttInstance ) || ganttTask.showRightText !== true ) {
        return;
    }
    let rightText = [];
    rightText.push( '<div class="gantt_task_text">' + ganttTask.text + '</div>' );
    return rightText.join( '' );
};

const getMilestoneTooltipText = ( start, end, ganttTask, ganttInstance ) => {
    let tooltipText = [];
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    tooltipText.push( '<strong>' + ganttTask.text + '- </strong>' );
    tooltipText.push( '<strong>' + ganttTask.fnd0StatusUiValue + '</strong>' );
    tooltipText.push( '<br/>' );
    tooltipText.push( '<strong>' + ganttInstance.locale.labels.timeline_label_plannedDate + ': </strong> ' + ganttInstance.templates.tooltip_date_format( new Date( ganttTask.getUiValue(
        'start_date' ) ) ) );
    return tooltipText.join( '' );
};

const canShowTooltip = ( ganttInstance ) => {
    return ganttInstance.showEventProperties !== 'true';
};

const getEventTooltip = ( start, end, ganttTask, ganttInstance ) => {
    if( !canShowTooltip( ganttInstance ) ) {
        return;
    }
    let tooltipText = [];
    tooltipText.push( '<div class="gantt_tooltip_text">' );
    var icon = '<div class=\'gantt_tooltip_open_icon\' task_id=' + ganttTask.id + '></div>';
    if( ganttTask.prg0EventCode ) {
        tooltipText.push( '<strong>' + ganttTask.prg0EventCode + '- </strong>' );
    }
    tooltipText.push( '<strong>' + ganttTask.text + '</strong>' );
    tooltipText.push( icon );
    if( ganttTask.prg0State ) {
        tooltipText.push( ' -<strong>' + ganttTask.prg0State + '</strong>' );
    }
    tooltipText.push( '<br/>' );
    tooltipText.push( '<strong> Planned Date : </strong> ' + ganttInstance.templates.tooltip_date_format( new Date( ganttTask.getUiValue( 'prg0PlannedDate' ) ) ) );
    tooltipText.push( '<br/>' );
    if( ganttTask.prg0ForecastDate ) {
        tooltipText.push( '<strong> Forecast Date : </strong> ' + ganttInstance.templates.tooltip_date_format( new Date( ganttTask.getUiValue( 'prg0ForecastDate' ) ) ) );
        tooltipText.push( '<br/>' );
    }
    if( ganttTask.prg0ActualDate ) {
        tooltipText.push( '<strong> Actual Date : </strong> ' + ganttInstance.templates.tooltip_date_format( new Date( ganttTask.getUiValue( 'prg0ActualDate' ) ) ) );
        tooltipText.push( '<br/>' );
    }
    return tooltipText.join( '' );
};
