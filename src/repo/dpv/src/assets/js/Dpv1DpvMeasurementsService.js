// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Dpv1DpvMeasurementsService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import dateTimeService from 'js/dateTimeService';
import soaService from 'soa/kernel/soaService';
import tabRegistrySvc from 'js/tabRegistry.service';
import eventBus from 'js/eventBus';
import mesgSvc from 'js/messagingService';

var exports = {};

/**
 * Return the UTC format date string "yyyy-MM-dd'T'HH:mm:ssZZZ"
 *
 * @param {date} dateObject {String} dateValue - UTC format date.
 * @returns {date} date in UTC format
 */
export let getDateString = function( dateObject ) {
    var dateValue;
    dateValue = dateTimeService.formatUTC( dateObject );
    if( dateValue === '' ) {
        dateValue = dateTimeService.NULLDATE;
    }
    return dateValue;
};


export let updateDateRangeInCtx = function( data ) {
    var fromDate = exports.getDateString( data.fromDate.dateApi.dateObject );
    var toDate   = exports.getDateString( data.toDate.dateApi.dateObject );
    var jsn = data.jsnTextbox.uiValue;
    var routineId = appCtxSvc.ctx.selected.props.awb0ArchetypeId.uiValues[0];
    if( jsn !== '' ) {
        fromDate = '';
        toDate   = '';
    }

    var dpvCtx = appCtxSvc.getCtx( 'Dpv' );
    if( dpvCtx ) {
        dpvCtx = {
            fromDate: fromDate,
            toDate: toDate,
            jsn: jsn,
            routineId: routineId
        };
        appCtxSvc.updateCtx( 'Dpv', dpvCtx );
    } else {
        dpvCtx = {
            fromDate: fromDate,
            toDate: toDate,
            jsn: jsn,
            routineId: routineId
        };
        appCtxSvc.registerCtx( 'Dpv', dpvCtx );
    }
    var measTab = 'Measurements';

    var tabToSelect = tabRegistrySvc.getVisibleTabs( 'occmgmtContext' ).filter( function( tab ) {
        return tab.name === measTab;
    } )[0];

    tabRegistrySvc.changeTab( 'occmgmtContext', tabToSelect.tabKey );
};

export let registerContext = function() {
    //get context values
    //if blank set below else set context values
    var fromDate = dateTimeService.formatUTC( new Date( new Date().setFullYear( new Date().getFullYear() - 1 ) ) );
    var toDate = dateTimeService.formatUTC( new Date() );
    var routineId = appCtxSvc.ctx.selected.props.awb0ArchetypeId.uiValues[0];
    var jsn = '';

    var dpvCtx = {
        fromDate: fromDate,
        toDate: toDate,
        jsn: jsn,
        routineId: routineId
    };
    if( !appCtxSvc.ctx.Dpv ) {
        appCtxSvc.registerCtx( 'Dpv', dpvCtx );
    }
};

export let unregisterContext = function() {
    appCtxSvc.unRegisterCtx( 'Dpv' );
};

export let loadMeasurementData = function( plantId, routineId, fromDate, toDate, jsn ) {
    if( !appCtxSvc.ctx.Dpv ) {
        exports.registerContext();
    }

    if( routineId ) {
        var plantId         = plantId;
        var routineId       = routineId;
        var clientId        = '1';
        var fromDate        = fromDate;
        var toDate          = toDate;
        var jsn             = jsn;
        var activeInactive  = 'ALL';
    } else {
        var plantId         = plantId;
        var routineId       = appCtxSvc.ctx.Dpv.routineId;
        var clientId        = '1';
        var fromDate        = appCtxSvc.ctx.Dpv.fromDate;
        var toDate          = appCtxSvc.ctx.Dpv.toDate;
        var jsn             = appCtxSvc.ctx.Dpv.jsn;
        var activeInactive  = 'ALL';
    }

    var searchCriterion = [];
    var searchCriterionData = {
        clientId:       clientId,
        plantId:        plantId,
        routineId:      routineId,
        fromDate:       fromDate,
        toDate:         toDate,
        jsn:            jsn,
        activeInactive: activeInactive
    };
    searchCriterion.push( searchCriterionData );

    var deferred = AwPromiseService.instance.defer();
    var totalFound = 0;
    var outputData;
    // Call SOA to save the modified data
    soaService.postUnchecked( 'ProductionManagement-2008-03-MeasurementDataQuery', 'queryActiveOrDeactiveData', { searchCriterion } ).then(
        function( response ) {
            if( response && response.events && response.events.length > 0 ) {
                totalFound = response.events[0].eventsSet.length;

                if( totalFound > 0 ) {
                    outputData = {
                        'totalFound ': totalFound,
                        dpvEvents: response.events[0].eventsSet
                    };
                    deferred.resolve( outputData );
                } else {
                    var messageText = 'Data not available for given criteria';
                    mesgSvc.showInfo( messageText );
                }
            }
            deferred.resolve();
        },
        function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

export let activateDeactiveEvents = function( dataProvider, flag ) {
    var selectedObjects = dataProvider.getSelectedObjects();
    if( selectedObjects.length > 0 ) {
        var targetRows = [];

        for ( var idx = 0; idx < selectedObjects.length; idx++ ) {
            //var activeInactive  = (selectedObjects[idx].props.active.value === 0)? 1:0 ;
            var activeInactive  = flag;
            var plantId         = selectedObjects[idx].props.plantId.value;
            var eventSysId      = selectedObjects[idx].props.eventSysId.value;

            var targetRow = {
                activeInactive: activeInactive,
                plantId: plantId,
                eventSysId: eventSysId
            };
            targetRows.push( targetRow );
        }
        var deferred = AwPromiseService.instance.defer();
        if( targetRows.length > 0 ) {
            // Call SOA to save the modified data
            const promise = soaService.postUnchecked( 'ProductionManagement-2008-03-MeasurementDataEdit', 'activateOrDeactivateData',
                { targetRows } );
            return promise.then( function( ) {
                deferred.resolve();
            } );
        }
        deferred.resolve();

        return deferred.promise;
    }
};

export let refreshMeasTable = function() {
    eventBus.publish( 'measurementsTable.plTable.reload' );
};


export default exports = {
    getDateString,
    loadMeasurementData,
    activateDeactiveEvents,
    unregisterContext,
    registerContext,
    updateDateRangeInCtx,
    refreshMeasTable
};
