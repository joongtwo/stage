//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/UITimeline
 */
import timelineUtils from 'js/Timeline/uiTimelineUtils';
import appCtx from 'js/appCtxService';

'use strict';

var exports = {};

/**
 * This function will initialize the timeline.
 *
 * @param {Object} data- The data Object.
 * @param {Object} input - The input required to show the timeline.
 */
export let initializeTimeline = function( data, openedObject ) {
    timelineUtils.findCountWithZoomeLevel( 'Event' );
    timelineUtils.addTodayMarker();
    appCtx.registerCtx( 'pageId' );
    var readOnly = false;
    var startDate = null;
    var endDate = null;
    var timelineConfig = getTimelineConfig( readOnly, startDate, endDate );
    var timelineZoomPreference;
    timelineZoomPreference =  appCtx.ctx.preferences.AWC_Timeline_Zoom_Level ? appCtx.ctx.preferences.AWC_Timeline_Zoom_Level[ 0 ] : undefined;
    //for case when only sublocation change occurs
    var ctxGanttZoomLevel = appCtx.ctx.timelineZoomLevel;
    if( !appCtx.ctx.preferences.AWC_Timeline_Zoom_Level && ctxGanttZoomLevel ) {
        timelineZoomPreference = ctxGanttZoomLevel;
    } else if( appCtx.ctx.preferences.AWC_Timeline_Zoom_Level ) {
        appCtx.ctx.AWC_Timeline_Zoom_Level = appCtx.ctx.preferences.AWC_Timeline_Zoom_Level[ 0 ];
    }
    timelineUtils.setTimelineConfig( timelineConfig, timelineZoomPreference, openedObject  );
    var date = setupDates( data );
    var labels = setupLables( data );
    timelineUtils.initLocale( date, labels );
    setDefaultColumns( data.i18n.timeline_column_levels );
};

/**
 * Sets the default columns for the timeline.
 *
 * @param {var} levelColumn - The level column name.
 */
var setDefaultColumns = function( levelColumn ) {
    var columns = [];
    var nameCol = {};
    nameCol.name = 'text';
    nameCol.tree = true;
    nameCol.label = levelColumn;
    nameCol.align = 'left';
    nameCol.width = '*';
    nameCol.resize = true;
    nameCol.min_width = 100;
    columns.push( nameCol );
    timelineUtils.setDefaultColumns( columns );
};

/**
 * Initializes the label object for the locale.
 *
 * @param {Object} data - The data Object
 * @return The label object.
 */
var setupLables = function( data ) {
    return initLables( data.i18n.gantt_label_new_task, data.i18n.gantt_label_icon_save,
        data.i18n.gantt_label_icon_cancel, data.i18n.gantt_label_icon_details, data.i18n.gantt_label_icon_edit,
        data.i18n.gantt_label_icon_delete, data.i18n.gantt_label_confirm_deleting,
        data.i18n.gantt_label_section_description, data.i18n.gantt_label_section_time,
        data.i18n.gantt_label_section_type, data.i18n.gantt_label_column_text,
        data.i18n.gantt_label_column_start_date, data.i18n.gantt_label_column_duration, data.i18n.gantt_label_link,
        data.i18n.gantt_label_link_start, data.i18n.gantt_label_link_end, data.i18n.gantt_label_type_task,
        data.i18n.gantt_label_type_project, data.i18n.gantt_label_type_milestone, data.i18n.gantt_label_minutes,
        data.i18n.gantt_label_hours, data.i18n.gantt_label_days, data.i18n.gantt_label_weeks,
        data.i18n.gantt_label_months, data.i18n.gantt_label_years, data.i18n.gantt_label_today,
        data.i18n.timeline_label_forecastDate, data.i18n.timeline_label_actualDate, data.i18n.timeline_label_plannedDate,
        data.i18n.timeline_label_deliverables, data.i18n.timeline_label_changes, data.i18n.timeline_label_schedules,
        data.i18n.timeline_label_risks, data.i18n.timeline_label_issues, data.i18n.timeline_label_opportunities,
        data.i18n.timeline_label_criteria, data.i18n.timeline_label_checklist );
};

/**
 * Constructs the Label object for the locale.
 *
 * @param gantt_label_new_task New task
 * @param gantt_label_icon_save Icon Save
 * @param gantt_label_icon_cancel Icon Cancel
 * @param gantt_label_icon_details Details
 * @param gantt_label_icon_edit Edit
 * @param gantt_label_icon_delete Delete
 * @param gantt_label_confirm_deleting Delete confirm
 * @param gantt_label_section_description Description
 * @param gantt_label_section_time section time
 * @param gantt_label_section_type type
 * @param gantt_label_column_text text
 * @param gantt_label_column_start_date start date
 * @param gantt_label_column_duration duration
 * @param gantt_label_link link
 * @param gantt_label_link_start link start
 * @param gantt_label_link_end link end
 * @param gantt_label_type_task task type
 * @param gantt_label_type_project project type
 * @param gantt_label_type_milestone milestone
 * @param gantt_label_minutes minutes
 * @param gantt_label_hours hours
 * @param gantt_label_days days
 * @param gantt_label_weeks weeks
 * @param gantt_label_months months
 * @param gantt_label_years years
 * @param gantt_label_today Today
 * @param timeline_label_forecastDate ForecastDate
 * @param timeline_label_actualDate ActualDate
 * @param timeline_label_plannedDate PlannedDate
 * @return The Label object.
 */
var initLables = function( gantt_label_new_task, gantt_label_icon_save, gantt_label_icon_cancel,
    gantt_label_icon_details, gantt_label_icon_edit, gantt_label_icon_delete, gantt_label_confirm_deleting,
    gantt_label_section_description, gantt_label_section_time, gantt_label_section_type, gantt_label_column_text,
    gantt_label_column_start_date, gantt_label_column_duration, gantt_label_link, gantt_label_link_start,
    gantt_label_link_end, gantt_label_type_task, gantt_label_type_project, gantt_label_type_milestone,
    gantt_label_minutes, gantt_label_hours, gantt_label_days, gantt_label_weeks, gantt_label_months,
    gantt_label_years, gantt_label_today, timeline_label_forecastDate, timeline_label_actualDate,
    timeline_label_plannedDate, timeline_label_deliverables, timeline_label_changes, timeline_label_schedules, timeline_label_risks,
    timeline_label_issues, timeline_label_opportunities, timeline_label_criteria, timeline_label_checklist ) {
    var labels = {};
    labels.new_task = gantt_label_new_task;
    labels.icon_save = gantt_label_icon_save;
    labels.icon_cancel = gantt_label_icon_cancel;
    labels.icon_details = gantt_label_icon_details;
    labels.icon_edit = gantt_label_icon_edit;
    labels.icon_delete = gantt_label_icon_delete;
    labels.confirm_closing = '';
    labels.confirm_deleting = gantt_label_confirm_deleting;
    labels.section_description = gantt_label_section_description;
    labels.section_time = gantt_label_section_time;
    labels.section_type = gantt_label_section_type;
    labels.column_text = gantt_label_column_text;
    labels.column_start_date = gantt_label_column_start_date;
    labels.column_duration = gantt_label_column_duration;
    labels.column_add = '';
    labels.link = gantt_label_link;
    labels.link_start = gantt_label_link_start;
    labels.link_end = gantt_label_link_end;
    labels.type_task = gantt_label_type_task;
    labels.type_project = gantt_label_type_project;
    labels.type_milestone = gantt_label_type_milestone;
    labels.minutes = gantt_label_minutes;
    labels.hours = gantt_label_hours;
    labels.days = gantt_label_days;
    labels.weeks = gantt_label_weeks;
    labels.months = gantt_label_months;
    labels.years = gantt_label_years;
    labels.today = gantt_label_today;
    labels.timeline_label_forecastDate = timeline_label_forecastDate;
    labels.timeline_label_actualDate = timeline_label_actualDate;
    labels.timeline_label_plannedDate = timeline_label_plannedDate;
    labels.timeline_label_deliverables = timeline_label_deliverables;
    labels.timeline_label_changes = timeline_label_changes;
    labels.timeline_label_schedules = timeline_label_schedules;
    labels.timeline_label_risks = timeline_label_risks;
    labels.timeline_label_issues = timeline_label_issues;
    labels.timeline_label_opportunities = timeline_label_opportunities;
    labels.timeline_label_criteria = timeline_label_criteria;
    labels.timeline_label_checklist = timeline_label_checklist;
    return labels;
};

/**
 * Initializes the date object for the Gantt.
 *
 * @param {Object} data - The data Object.
 */
var setupDates = function( data ) {
    var monthFull = initializeMonthFull( data.i18n.gantt_month_January, data.i18n.gantt_month_February,
        data.i18n.gantt_month_March, data.i18n.gantt_month_April, data.i18n.gantt_month_May,
        data.i18n.gantt_month_June, data.i18n.gantt_month_July, data.i18n.gantt_month_August,
        data.i18n.gantt_month_September, data.i18n.gantt_month_October, data.i18n.gantt_month_November,
        data.i18n.gantt_month_December );

    var monthShort = initializeMonthShort( data.i18n.gantt_month_Jan, data.i18n.gantt_month_Feb,
        data.i18n.gantt_month_Mar, data.i18n.gantt_month_Apr, data.i18n.gantt_month_May_short,
        data.i18n.gantt_month_Jun, data.i18n.gantt_month_Jul, data.i18n.gantt_month_Aug, data.i18n.gantt_month_Sep,
        data.i18n.gantt_month_Oct, data.i18n.gantt_month_Nov, data.i18n.gantt_month_Dec );

    var dayFull = initializeDayFull( data.i18n.gantt_day_Sunday, data.i18n.gantt_day_Monday,
        data.i18n.gantt_day_Tuesday, data.i18n.gantt_day_Wednesday, data.i18n.gantt_day_Thursday,
        data.i18n.gantt_day_Friday, data.i18n.gantt_day_Saturday );

    var dayShort = initializeDayShort( data.i18n.gantt_day_sun, data.i18n.gantt_day_mon, data.i18n.gantt_day_tue,
        data.i18n.gantt_day_wed, data.i18n.gantt_day_thu, data.i18n.gantt_day_fri, data.i18n.gantt_day_sat );

    return initializeDate( monthFull, monthShort, dayFull, dayShort );
};

/**
 * Constructs the date object for the locale.
 *
 * @param monthFull Array of month objects in their full form.
 * @param monthShort Array of month objects in their short form.
 * @param dayFull Array of day objects in their full form.
 * @param dayShort Array of day objects in their short form.
 * @return The date object.
 */
var initializeDate = function( monthFull, monthShort, dayFull, dayShort ) {
    var date = {};
    date.month_full = monthFull;
    date.month_short = monthShort;
    date.day_full = dayFull;
    date.day_short = dayShort;
    return date;
};

/**
 * Constructs the days in short for the date.
 *
 * @param sunday Sunday
 * @param monday Monday
 * @param tuesday Tuesday
 * @param wednesday Wednesday
 * @param thursday Thursday
 * @param friday Friday
 * @param saturday Saturday
 * @return Java-script Array for Days in short form.
 */
var initializeDayShort = function( sunday, monday, tuesday, wednesday, thursday, friday, saturday ) {
    var day_short = [];
    day_short.push( sunday );
    day_short.push( monday );
    day_short.push( tuesday );
    day_short.push( wednesday );
    day_short.push( thursday );
    day_short.push( friday );
    day_short.push( saturday );
    return day_short;
};

/**
 * Constructs the days in full for the date.
 *
 * @param sunday Sunday
 * @param monday Monday
 * @param tuesday Tuesday
 * @param wednesday Wednesday
 * @param thursday Thursday
 * @param friday Friday
 * @param saturday Saturday
 * @return Java-script Array for Days in full form.
 */
var initializeDayFull = function( sunday, monday, tuesday, wednesday, thursday, friday, saturday ) {
    var day_full = [];
    day_full.push( sunday );
    day_full.push( monday );
    day_full.push( tuesday );
    day_full.push( wednesday );
    day_full.push( thursday );
    day_full.push( friday );
    day_full.push( saturday );
    return day_full;
};

/**
 * Constructs the months in short for the date..
 *
 * @param jan January
 * @param feb February
 * @param march March
 * @param april April
 * @param may May
 * @param june June
 * @param july July
 * @param august August
 * @param september September
 * @param october October
 * @param november November
 * @param december December
 * @return Java-script array for months in short form.
 */
var initializeMonthShort = function( jan, feb, march, april, may, june, july, august, september, october, november,
    december ) {
    var month_short = [];
    month_short.push( jan );
    month_short.push( feb );
    month_short.push( march );
    month_short.push( april );
    month_short.push( may );
    month_short.push( june );
    month_short.push( july );
    month_short.push( august );
    month_short.push( september );
    month_short.push( october );
    month_short.push( november );
    month_short.push( december );
    return month_short;
};

/**
 * Constructs the months in full for the date.
 *
 * @param jan January
 * @param feb February
 * @param march March
 * @param april April
 * @param may May
 * @param june June
 * @param july July
 * @param august August
 * @param september September
 * @param october October
 * @param november November
 * @param december December
 * @return Java-script array for months in full form.
 */
var initializeMonthFull = function( jan, feb, march, april, may, june, july, august, september, october, november,
    december ) {
    var month_full = [];
    month_full.push( jan );
    month_full.push( feb );
    month_full.push( march );
    month_full.push( april );
    month_full.push( may );
    month_full.push( june );
    month_full.push( july );
    month_full.push( august );
    month_full.push( september );
    month_full.push( october );
    month_full.push( november );
    month_full.push( december );
    return month_full;
};

/**
 * Initializes the timeline configuration object.
 *
 * @param {var} readOnly - the read-only flag.
 * @param {date} startDate - The Start Date of the Gantt time line.
 * @param {date} endDate The End Date of the Gantt time line.
 */
var getTimelineConfig = function( readOnly, startDate, endDate ) {
    var TimelineConfig = {};
    TimelineConfig.readOnly = readOnly;
    TimelineConfig.orderBranch = false;
    TimelineConfig.dragMove = true;
    TimelineConfig.dragResize = false;
    TimelineConfig.dragProgress = false;
    TimelineConfig.dragLinks = true;
    TimelineConfig.detailsOnDbClick = false;
    TimelineConfig.autoScheduling = false;
    TimelineConfig.autoSchedulingInitial = false;
    TimelineConfig.autoSchedulingStrict = false;
    TimelineConfig.roundDndDates = false;
    TimelineConfig.startDate = startDate;
    TimelineConfig.endDate = endDate;
    return TimelineConfig;
};

export default exports = {
    initializeTimeline
};
