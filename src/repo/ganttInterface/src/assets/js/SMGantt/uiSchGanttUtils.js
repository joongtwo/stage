// Copyright (c) 2022 Siemens

/**
 * @module js/SMGantt/uiSchGanttUtils
 */
import _ from 'lodash';
import ganttManager from 'js/uiGanttManager';
import appCtxSvc from 'js/appCtxService';
import _cdm from 'soa/kernel/clientDataModel';
import _cmm from 'soa/kernel/clientMetaModel';
import ganttConstants from 'js/SMGantt/GanttConstants';
import tableSvc from 'js/published/splmTablePublishedService';

var exports = {};

/**
 * Method to get header height of the gantt.
 * @returns height of the header
 */
let getGanttHeaderHeight = function( ) {
    // This is the header height used for tree table.
    return 72;
};

/**
 * Method to get row height of the gantt - based on the display mode.
 * @returns row height of the gantt
 */
let getGanttRowHeight = function( ) {
    // Set the row height based on the display mode, similar to splm table.
    let rowHeight = appCtxSvc.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW;
    return rowHeight + 1;
};

/**
 * Method to get scale based on preference(AWC_SM_Unit_Of_Measure) value
 * @param scale -Scale to map.
 * @returns mapping for UOM to gantt scale
 */
let getGanttScaleMapping = function( scale ) {
    switch ( scale ) {
        case 'h':
            return 'year';
        case 'd':
            return 'year';
        case 'w':
            return 'day';
        case 'mo':
            return 'week';
    }
};

/**
 * Transformation function for the viewType preference value to Gantt scale
 * @param {String} viewType preference value
 * @param {Boolean} isToRefresh flag to refresh Gantt
 * @param {Boolean} isTransformValue flag to transform the value for Gantt or not
 */
export let setGanttZoomLevel = function( viewType, isToRefresh, isTransformValue ) {
    if( isTransformValue ) {
        switch ( viewType ) {
            case 'day':
                viewType = 'year';
                break;
            case 'week':
                viewType = 'day';
                break;
            case 'month':
                viewType = 'week';
                break;
            case 'year':
                viewType = 'month';
                break;
            case 'unit_of_time_measure': {
                let uotm = _.get( appCtxSvc.ctx.selected, 'props.saw1UnitOfTimeMeasure.dbValues[0]', undefined );
                if( uotm ) {
                    viewType = getGanttScaleMapping( uotm );
                }
                break;
            }
        }
    }
    exports.loadGanttScale( viewType );
    if( isToRefresh ) {
        ganttManager.getGanttInstance().render();
    }
};

/**
 * Update the AWC_SM_Gantt_Zoom_Level zoom level preference value in data
 * @param {Object} data Declarative viewModel
 */
export let updatePreferenceForGanttZoom = function( data ) {
    var preference = appCtxSvc.getCtx( 'preferences.AWC_SM_Gantt_Zoom_Level' );
    if( !preference ) {
        appCtxSvc.registerCtx( 'ganttZoomLevel', data.eventData.viewType );
    } else {
        preference[0] = data.eventData.viewType;
        appCtxSvc.updateCtx( 'preferences.AWC_SM_Gantt_Zoom_Level', preference );
    }
};

/**
 * This function will set the Task properties flag to true
 * It will then be used to show task properties on Gantt task bar
 */
export let showGanttTaskProperties = function() {
    if ( appCtxSvc.ctx.showGanttTaskProperties === true ) {
        appCtxSvc.registerCtx( 'showGanttTaskProperties', false );
    } else {
        appCtxSvc.registerCtx( 'showGanttTaskProperties', true );
    }
    ganttManager.getGanttInstance().render();
};

/**
 * Load the Gantt scale for given scale value
 * @param {String} viewType The scale value
 */
export let loadGanttScale = function( viewType ) {
    switch ( viewType ) {
        case 'year': {
            ganttManager.getGanttInstance().config.scale_unit = 'day';
            ganttManager.getGanttInstance().config.step = 1;
            ganttManager.getGanttInstance().config.date_scale = '%d, %D';
            ganttManager.getGanttInstance().config.scale_height = getGanttHeaderHeight();
            let weekScaleForYear = function( date ) {
                let weekText = ganttManager.getGanttInstance().locale.labels.weeks;
                let dateToStr = ganttManager.getGanttInstance().date.date_to_str( '%d %m' );
                let weekNum = ganttManager.getGanttInstance().date.date_to_str( '(' + weekText + ' %W)' );
                let endDate = ganttManager.getGanttInstance().date.add( ganttManager.getGanttInstance().date
                    .add( date, 1, 'week' ), -1, 'day' );
                return dateToStr( date ) + ' - ' + dateToStr( endDate ) + ' ' + weekNum( date );
            };
            ganttManager.getGanttInstance().config.subscales = [ {
                unit: 'month',
                step: 1,
                date: '%F, %Y'
            }, {
                unit: 'week',
                step: 1,
                template: weekScaleForYear
            } ];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                if( !ganttManager.getGanttInstance().isWorkTime( date ) ) {
                    return 'week_end';
                }
                return '';
            };
            break;
        }
        case 'day': {
            ganttManager.getGanttInstance().config.scale_unit = 'week';
            ganttManager.getGanttInstance().config.step = 1;
            ganttManager.getGanttInstance().config.scale_height = getGanttHeaderHeight();
            ganttManager.getGanttInstance().config.subscales = [ {
                unit: 'month',
                step: 1,
                date: '%M'
            } ];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            let weekScaleForDay = function( date ) {
                let dateToStr = ganttManager.getGanttInstance().date.date_to_str( '%d' );
                let endDate = ganttManager.getGanttInstance().date.add( ganttManager.getGanttInstance().date
                    .add( date, 1, 'week' ), -1, 'day' );
                let weekNum = ganttManager.getGanttInstance().date.date_to_str( '(%W)' );
                return dateToStr( date ) + '-' + dateToStr( endDate ) + ' ' + weekNum( date );
            };
            ganttManager.getGanttInstance().templates.date_scale = weekScaleForDay;
            break;
        }
        case 'week': {
            ganttManager.getGanttInstance().config.scale_unit = 'month';
            ganttManager.getGanttInstance().config.date_scale = '%M';
            ganttManager.getGanttInstance().config.scale_height = getGanttHeaderHeight();
            ganttManager.getGanttInstance().config.subscales = [ {
                unit: 'year',
                step: 1,
                date: '%Y'
            } ];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
        }
        case 'month': {
            ganttManager.getGanttInstance().config.scale_unit = 'year';
            ganttManager.getGanttInstance().config.step = 1;
            ganttManager.getGanttInstance().config.date_scale = '%Y';
            ganttManager.getGanttInstance().config.scale_height = getGanttHeaderHeight();
            ganttManager.getGanttInstance().config.subscales = [];
            ganttManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
        }
    }
};

/**
 * Get all event model objects from DHTMLX Gantt
 *
 * @return {Array} events  event model objects from Gantt
 */
export let getAllEventsFromGantt = () => {
    let events = [];
    // get all event list from Gannt using DHTMLX API
    ganttManager.getGanttInstance().eachTask( function( task ) {
        let modelObject = _cdm.getObject( task.id );
        if( _cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

/**
 * Get Gantt types to exclude from Task Infromation processing
 *
 * @return {Array} events  event model objects from Gantt
 */
export let getTypesToExcludeFromTaskInformation = () =>{
    let typesToExclude = [];
    typesToExclude.push( ganttConstants.GANTT_TASK_SOURCE_TYPE_EVENT );
    return typesToExclude;
};


exports = {
    loadGanttScale,
    setGanttZoomLevel,
    showGanttTaskProperties,
    updatePreferenceForGanttZoom,
    getAllEventsFromGantt,
    getTypesToExcludeFromTaskInformation
};

export default exports;
