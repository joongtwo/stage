// Copyright (c) 2022 Siemens

/**
 * Module to provide the service for SM Gantt.
 *
 * @module js/GanttService
 */
import appCtxService from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import ganttManager from 'js/uiGanttManager';
import moduleLoader from 'js/moduleLoader';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import ganttUtils from 'js/GanttUtils';
import ganttConstants from 'js/SMGantt/GanttConstants';
import viewModelService from 'js/viewModelService';
//import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';

let exports = {};
let ganttProcessor;
let _awEvents = [];
let _ganttScrollEvent;

export let initializeProcessorClass = ( data, declViewModel, deferred ) => {
    let dataProcessorClass = getGanttGrid( declViewModel ).gridOptions.dataProcessorClass;
    let ganttProcessorPath = 'js/' + dataProcessorClass;
    moduleLoader.loadDependentModule( ganttProcessorPath ).then(
        ( depModuleObj ) => {
            ganttProcessor = depModuleObj;
            deferred.resolve();
        }
    );
    data.arrangeColumns = () => {
        ganttProcessor.arrangeColumns( declViewModel.columns );
    };
    return deferred.promise;
};

let getGanttGrid = ( declViewModel ) => {
    let ganttGrid;
    if( declViewModel.grids ) {
        ganttGrid = declViewModel.grids[ declViewModel.ganttid ];
    }
    return ganttGrid;
};

export let readDataProvider = ( declViewModel ) => {
    let dataProvider;
    let ganttGrid = getGanttGrid( declViewModel );
    if( ganttGrid && ganttGrid.dataProvider ) {
        dataProvider = declViewModel.dataProviders[ ganttGrid.dataProvider ];
    }
    return dataProvider;
};

export let readGanttConfigAndPrepareProvider = ( data, declViewModel ) => {
    let ctx = appCtxService.ctx;
    let scope = {};
    let ganttGrid = getGanttGrid( declViewModel );

    if( ganttGrid && ganttGrid.dataProvider ) {
        let dataProvider = declViewModel.dataProviders[ ganttGrid.dataProvider ];
        let columnProvider = awColumnSvc.createColumnProvider( declViewModel, scope,
            dataProvider.commands, declViewModel.ganttid, dataProvider.json.commandsAnchor );

        data.dataprovider = dataProvider;
        data.ganttOptions = ganttGrid.gridOptions;
        declViewModel.ganttOptions = ganttGrid.gridOptions;
        declViewModel.ganttSourceObject = appCtxService.ctx.selected;
        return initializeProvider( data, dataProvider, columnProvider, declViewModel, ctx );
    }
};

let initializeProvider = ( data, dataProvider, columnProvider, declViewModel, ctx ) => {
    let ganttGrid = getGanttGrid( declViewModel );
    return columnProvider.initialize().then( async( columns ) => {
        /**
         * Dont re-initialize DP if it already exists
         */
        if( columns ) {
            data.ganttColumns = ganttProcessor.prepareColumnsForGantt( columns, declViewModel );
        }
        if( data.ganttColumns && data.ganttColumns.length > 0 ) {
            declViewModel.ganttColumns = data.ganttColumns;
            declViewModel.ganttColumnMap = data.columnMapping;
        }
        if( dataProvider.json && dataProvider.json.firstPage ) {
            // Do Nothing
            return null;
        }
        if( declViewModel.columns ) {
            let types = {};
            let typeList = [];
            declViewModel.columns.forEach( ( col ) => {
                let objectType = {};
                let propertiesContainer = [];
                objectType.name = col.columnSrcType;
                propertiesContainer.push( {
                    name: col.propDescriptor.propertyName
                } );

                objectType.properties = propertiesContainer;
                typeList.push( objectType );
            } );

            types.types = typeList;

            let propertyPolicyID = propPolicySvc.register( types );
        }

        let a = {
            data:declViewModel,
            ctx:ctx
        };

        return dataProvider.initialize( a ).then( () => {
            if( declViewModel.ganttConfigColumns && ganttGrid.gridOptions.columnsReturnedByDataProvider ) {
                return ganttProcessor.getColumnsFromConfigColumns( declViewModel.ganttConfigColumns ).then( ( columns ) => {
                    data.ganttColumns = ganttProcessor.prepareColumnsForGantt( columns, declViewModel );
                    declViewModel.ganttColumns = data.ganttColumns;
                    return null;
                } );
            }
            return null;
        } );
    } );
};

export let registerEventListeners = ( declViewModel ) => {
    let scrollTimeout;
    _ganttScrollEvent = ganttManager.getGanttInstance().attachEvent(
        'onGanttScroll',
        ( left, top ) => {
            clearTimeout( scrollTimeout );
            scrollTimeout = setTimeout( () => {
                afterRenderCallback( declViewModel );
            }, 100 );
        } );

    // Listen to layout change to adjust the row height.
    _awEvents.push( eventBus.subscribe( 'LayoutChangeEvent', ( data ) => {
        let dataSource = ganttProcessor.getDataSource();
        if( data && data.rowHeight ) {
            ganttManager.getGanttInstance().config.row_height = data.rowHeight + 1;

            let gridOptions = getGridOptions();
            dataSource.getBaselines().length > 1 ? ( gridOptions && appCtxService.ctx.layout === 'comfy' ? updateRowHeightInComfy( gridOptions, data.rowHeight ) : updateRowHeightInCompact( gridOptions, data.rowHeight ) ) : ( gridOptions.rowHeight ? resetGanttRowHeight( gridOptions, data.rowHeight ) : 'null' );
            ganttManager.getGanttInstance().render();
        }

        if( appCtxService.ctx.layout === 'comfy' ) {
            ganttManager.getGanttInstance().config.bar_height = dataSource.hasBaseline() ? (dataSource.getBaselines().length > 1) ? 18 : ganttConstants.GANTT_TASK_HEIGHT_PER_LAYOUT.COMFY : 'full';
        }
        if( appCtxService.ctx.layout === 'compact' ) {
            ganttManager.getGanttInstance().config.bar_height = dataSource.hasBaseline() ? (dataSource.getBaselines().length > 1) ? 18 : ganttConstants.GANTT_TASK_HEIGHT_PER_LAYOUT.COMPACT : 'full';
        }
        ganttUtils.updateBarHeightForEvents();
    } ) );

    _awEvents = _awEvents.concat( ganttProcessor.registerEventListeners( declViewModel ) );
};

let getGridOptions = () => {

   /* let viewModel = viewModelService.getViewModelUsingElement( schNavTreeUtils.getScheduleNavigationTreeTableElement() );
    if( viewModel ) {
        return viewModel.grids.scheduleNavigationTree.gridOptions;
    }*/
};

let updateRowHeightInCompact = ( gridOptions, rowHeight ) => {
    // splm table
    gridOptions.rowHeight = 'LARGE';
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    //gantt row     
    ganttManager.getGanttInstance().config.row_height = rowHeight + 32;
};

let updateRowHeightInComfy = ( gridOptions, rowHeight ) => {
    // splm table
    gridOptions.rowHeight = 'LARGE';
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    //gantt row       
    ganttManager.getGanttInstance().config.row_height = rowHeight + 24;
};

let resetGanttRowHeight = ( gridOptions, rowHeight ) => {
    gridOptions.rowHeight = rowHeight;
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
};

export let getGanttHeight = () => {
    return ganttProcessor.getGanttHeight();
};

export let prepareGanttCustomisations = ( isShowGrid, declViewModel ) => {
    ganttProcessor.initGanttCustomisations( declViewModel );
    let ganttConfig = ganttProcessor.getConfigOptions( isShowGrid );
    for( let option in ganttConfig ) {
        ganttManager.getGanttInstance().config[ option ] = ganttConfig[ option ];
    }
};

export let prepareCalendarForGantt = () => {
    let eventRanges = ganttProcessor.initEventRanges();
    let dayRanges = ganttProcessor.initDayRanges();

    let calendarData = [];
    dayRanges.forEach( ( dayRange ) => {
        let dayofWeek = {};
        dayofWeek.day = dayRange.day;
        let timeSlot = dayRange.hours;
        if( !timeSlot ) {
            timeSlot = [];
        }
        dayofWeek.hours = timeSlot;
        calendarData.push( dayofWeek );
    } );
    eventRanges.forEach( ( eventDay ) => {
        ganttManager.getGanttInstance().setWorkTime( eventDay );
        calendarData.push( eventDay );
    } );
    return calendarData;
};

/**
 * Initializes the date object for the Gantt.
 */
export let setupDatesAndLocalization = ( declViewModel ) => {
    let localizedLabels = ganttProcessor.getLocalizedLabels( declViewModel );
    ganttManager.getGanttInstance().locale.labels = localizedLabels;
    let data = declViewModel;
    let monthFull = initializeMonthFull( data );

    let monthShort = initializeMonthShort( data );

    let dayFull = initializeDayFull( data.i18n.gantt_day_Sunday, data.i18n.gantt_day_Monday,
        data.i18n.gantt_day_Tuesday, data.i18n.gantt_day_Wednesday, data.i18n.gantt_day_Thursday,
        data.i18n.gantt_day_Friday, data.i18n.gantt_day_Saturday );

    let dayShort = initializeDayShort( data.i18n.gantt_day_sun, data.i18n.gantt_day_mon,
        data.i18n.gantt_day_tue, data.i18n.gantt_day_wed, data.i18n.gantt_day_thu, data.i18n.gantt_day_fri,
        data.i18n.gantt_day_sat );

    return initializeDate( monthFull, monthShort, dayFull, dayShort );
};

let initializeMonthFull = ( data ) => {
    let month_full = [];
    month_full.push( data.i18n.gantt_month_January );
    month_full.push( data.i18n.gantt_month_February );
    month_full.push( data.i18n.gantt_month_March );
    month_full.push( data.i18n.gantt_month_April );
    month_full.push( data.i18n.gantt_month_May );
    month_full.push( data.i18n.gantt_month_June );
    month_full.push( data.i18n.gantt_month_July );
    month_full.push( data.i18n.gantt_month_August );
    month_full.push( data.i18n.gantt_month_September );
    month_full.push( data.i18n.gantt_month_October );
    month_full.push( data.i18n.gantt_month_November );
    month_full.push( data.i18n.gantt_month_December );
    return month_full;
};

let initializeMonthShort = ( data ) => {
    let month_short = [];
    month_short.push( data.i18n.gantt_month_Jan );
    month_short.push( data.i18n.gantt_month_Feb );
    month_short.push( data.i18n.gantt_month_Mar );
    month_short.push( data.i18n.gantt_month_Apr );
    month_short.push( data.i18n.gantt_month_May_short );
    month_short.push( data.i18n.gantt_month_Jun );
    month_short.push( data.i18n.gantt_month_Jul );
    month_short.push( data.i18n.gantt_month_Aug );
    month_short.push( data.i18n.gantt_month_Sep );
    month_short.push( data.i18n.gantt_month_Oct );
    month_short.push( data.i18n.gantt_month_Nov );
    month_short.push( data.i18n.gantt_month_Dec );
    return month_short;
};

let initializeDayFull = ( sunday, monday, tuesday, wednesday, thursday, friday, saturday ) => {
    let day_full = [];
    day_full.push( sunday );
    day_full.push( monday );
    day_full.push( tuesday );
    day_full.push( wednesday );
    day_full.push( thursday );
    day_full.push( friday );
    day_full.push( saturday );
    return day_full;
};

let initializeDayShort = ( sunday, monday, tuesday, wednesday, thursday, friday, saturday ) => {
    let day_short = [];
    day_short.push( sunday );
    day_short.push( monday );
    day_short.push( tuesday );
    day_short.push( wednesday );
    day_short.push( thursday );
    day_short.push( friday );
    day_short.push( saturday );
    return day_short;
};

let initializeDate = ( monthFull, monthShort, dayFull, dayShort ) => {
    let date = {};
    date.month_full = monthFull;
    date.month_short = monthShort;
    date.day_full = dayFull;
    date.day_short = dayShort;
    return date;
};

export let addResizeListener = ( data ) => {
    window.addEventListener( 'resize', resizer );
    /**
     * This will resize the Gantt when the screen/browser size is changed.
    */
    function resizer() {
        let height = getGanttHeight();
        if( height ) {
            data.ganttWrapperHTMLElement.style.height = height + 'px';
        }
    }
};

export let afterRenderCallback = ( declViewModel ) => {
    if( ganttManager.getGanttInstance().config.smart_rendering ) {
        let visibleTasks = ganttProcessor.getVisibleTasks();
        callAfterRenderCallback( visibleTasks, declViewModel );
    }
};

let callAfterRenderCallback = ( visibleTasks, declViewModel ) => {
    if( visibleTasks.length > 0 ) {
        let ganttGrid = getGanttGrid( declViewModel );
        let isDelayLoadProps = ganttGrid.gridOptions.delayLoadProperties;
        ganttProcessor.afterRenderCallback( visibleTasks, declViewModel.ganttColumns, isDelayLoadProps, declViewModel, function( ganttTaskArray ) {
            ganttManager.getGanttInstance().refreshData();
        } );
    }
};

export let getGanttPlugins = function() {
    return ganttProcessor.getGanttPlugins();
};

export let cleanup = () => {
    for( let iEvent = 0; iEvent < _awEvents.length; ++iEvent ) {
        let event = _awEvents[ iEvent ];
        if( event ) {
            eventBus.unsubscribe( event );
        }
    }
    _awEvents = [];

    if ( ganttProcessor !== undefined ) {
        ganttProcessor.cleanup();
    }
    ganttManager.getGanttInstance().detachEvent( _ganttScrollEvent );
};

export default exports = {
    initializeProcessorClass,
    readDataProvider,
    readGanttConfigAndPrepareProvider,
    registerEventListeners,
    getGanttHeight,
    prepareGanttCustomisations,
    prepareCalendarForGantt,
    setupDatesAndLocalization,
    addResizeListener,
    afterRenderCallback,
    getGanttPlugins,
    cleanup
};
