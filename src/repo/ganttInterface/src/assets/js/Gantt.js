// Copyright (c) 2022 Siemens

/**
 * Module to provide the service for SM Gantt.
 *
 * @module js/Gantt
 */
import '@swf/dhtmlxgantt/skins/dhtmlxgantt_meadow.css';
import ganttManager from 'js/uiGanttManager';
import ganttService from 'js/GanttService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';

var exports = {};
var deferred;

export let loadGantt = ( data, subPanelContextInfo ) => {
    deferred = AwPromiseService.instance.defer();
    let viewModel = subPanelContextInfo.viewModel;
    var processorPromise = ganttService.initializeProcessorClass( data, viewModel, deferred );
    processorPromise.then( () => {
        var dataProvider = ganttService.readDataProvider( viewModel );
        var providerPromise = ganttService.readGanttConfigAndPrepareProvider( data, viewModel );

        let ganttInitializdEvent = eventBus.subscribe( 'AWGantt.dataInitialized', ( searchResults ) => {
            ganttManager.getGanttInstance().keep_grid_width = true;
            ganttManager.getGanttInstance().config.columns = data.ganttColumns;
            var ganttTasks = [];
            if( searchResults.searchResults.data ) {
                ganttTasks = searchResults.searchResults.data;
            }
            let ganttLinks = [];
            if( searchResults.searchResults.links ) {
                ganttLinks = searchResults.searchResults.links;
            }
            var ganttData = {
                data: ganttTasks,
                links: ganttLinks
            };

            var height = ganttService.getGanttHeight();
            var ganttWrapper;
            let htmlElems = document.getElementsByClassName( 'aw-ganttInterface-ganttWrapper' );
            if( htmlElems.length > 0 ) {
                ganttWrapper = htmlElems[ 0 ];
            } else {
                ganttWrapper = document.firstElementChild;
            }

            ganttWrapper.style.height = '100%';
            data.ganttWrapperHTMLElement = ganttWrapper;

            let isShowGrid = true;
            if( data.ganttOptions.showGrid !== undefined && data.ganttOptions.showGrid === false ) {
                isShowGrid = false;
            }
            ganttService.addResizeListener( data );

            var eventData = ganttService.prepareCalendarForGantt();
            eventData.forEach( ( event ) => {
                ganttManager.getGanttInstance().setWorkTime( event );
            } );
            let dates = ganttService.setupDatesAndLocalization( data );
            ganttManager.setLocalisedValues( dates );

            var startTime = new Date().getTime();

            let plugins = ganttService.getGanttPlugins();
            ganttManager.getGanttInstance().plugins( plugins );
            ganttManager.getGanttInstance().init( ganttWrapper );
            ganttService.prepareGanttCustomisations( isShowGrid, viewModel );

            var endTime = new Date().getTime();
            var delta = endTime - startTime;
            var total = ganttTasks.length;
            ganttManager.debugMessage( '1. Total time for init ' + total + ' objects took ' + delta +
                ' milliseconds' );

            startTime = new Date().getTime();

            ganttManager.getGanttInstance().parse( ganttData, 'json' );
            ganttService.afterRenderCallback( viewModel );

            endTime = new Date().getTime();
            delta = endTime - startTime;
            total = ganttTasks.length;
            ganttManager.debugMessage( '2. Total time for parse ' + total + ' objects took ' + delta +
                ' milliseconds' );

            ganttService.registerEventListeners( viewModel );

            dataProvider.ganttInitialized = true;
            eventBus.publish( viewModel.ganttid + '.ganttInitialized' );
            eventBus.unsubscribe( ganttInitializdEvent );
        } );
    } );
};

export let unLoadGantt = () => {
    ganttService.cleanup();
    ganttManager.destroyGanttInstance();
    deferred.resolve();
};

export default exports = {
    loadGantt,
    unLoadGantt
};
