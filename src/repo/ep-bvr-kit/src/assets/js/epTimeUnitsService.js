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

import _ from 'lodash';
import viewModelObjectService from 'js/viewModelObjectService';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import AwPromiseService from 'js/awPromiseService';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import appCtxSvc from 'js/appCtxService';
import { constants as epLoadConstants } from 'js/epLoadConstants';

/**
 * @module js/epTimeUnitsService
 */


//EP
const CURRENT_TIME_UNITS = 'currentTimeUnits';
const TIME_UNITS = 'timeUnits';
const TIME_UNITS_LONG_NAME = 'longName';
const TIME_UNITS_SHORT_NAME = 'shortName';

function getCurrentTimeUnit( longOrShort ) {
    let currentTimeUnit;
    const currentTimeUnitKey = epObjectPropertyCacheService.getProperty( CURRENT_TIME_UNITS, 'id' );
    if( currentTimeUnitKey ) {
        currentTimeUnit = epObjectPropertyCacheService.getProperty( currentTimeUnitKey, longOrShort )[ 0 ];
    }
    return currentTimeUnit;
}

export function getCurrentTimeUnitLong() {
    return getCurrentTimeUnit( TIME_UNITS_LONG_NAME );
}

export function getCurrentTimeUnitShort() {
    return getCurrentTimeUnit( TIME_UNITS_SHORT_NAME );
}

export function getAvailableTimeUnits() {
    let timeUnits = getTimeUnitsFromCache();
    if( timeUnits.length === 0 ) {
        const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.TIME_UNITS );

        return epLoadService.loadObject( loadTypeInputs, false ).then( function() {
            timeUnits = getTimeUnitsFromCache();
            return getTimeUnitsPromise( timeUnits );
        } );
    }
    return getTimeUnitsPromise( timeUnits );
}

function getTimeUnitsPromise( timeUnits ) {
    const timeUnitsVMOs = convertTimeUnitsToVMOs( timeUnits );
    const awPromise = AwPromiseService.instance;
    return awPromise.resolve( {
        timeUnitsCount: timeUnits.length,
        timeUnits: timeUnitsVMOs
    } );
}

function convertTimeUnitsToVMOs( timeUnits ) {
    let timeUnitsVMOs = [];
    _.forEach( timeUnits, function( timeUnit ) {
        const timeUnitModelObject = {
            uid: timeUnit.id
        };
        let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( timeUnitModelObject );
        vmo.timeUnitName = {
            uiValue: timeUnit.name
        };
        timeUnitsVMOs.push( vmo );
    } );
    return timeUnitsVMOs;
}

function getTimeUnitsFromCache() {
    const timeUnitsIds = epObjectPropertyCacheService.getProperty( TIME_UNITS, 'ids' );
    let timeUnits = [];
    if( timeUnitsIds ) {
        _.forEach( timeUnitsIds, function( id ) {
            timeUnits.push( {
                id: id,
                name: epObjectPropertyCacheService.getProperty( id, TIME_UNITS_LONG_NAME )[ 0 ]
            } );
        } );
    }
    return timeUnits;
}

export function changeTimeUnit( newTimeUnit ) {
    if( newTimeUnit && newTimeUnit.staticDisplayValue !== getCurrentTimeUnit( 'longName' ) ) {
        const timeUnits = getTimeUnitsFromCache();
        const timeUnit = _.filter( timeUnits, function( timeUnit ) {
            return timeUnit.name === newTimeUnit.staticDisplayValue;
        } );
        if( timeUnit ) {
            const saveInput = saveInputWriterService.get();
            saveInput.addTimeUnit( timeUnit[ 0 ].id );
            return epSaveService.saveChanges( saveInput ).then( function() {
                window.location.reload();
            } );
        }
    }
}

export function loadObjectData( viewModelData ) {
    const timeUnits = getTimeUnitsFromCache();
    return getTimeUnitsFromResponse( timeUnits, viewModelData );
}

function getTimeUnitsFromResponse( inputData, viewModelData ) {
    let timeUnitsLinkList = [];
    const awPromise = AwPromiseService.instance;
    const currentTimeUnit = getCurrentTimeUnit( 'longName' );
    if( inputData.length === 0 ) {
        const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.TIME_UNITS, appCtxSvc.ctx.state.params.uid );
        return epLoadService.loadObject( loadTypeInputs, false ).then( function( result ) {
            const responseObj = result.relatedObjectsMap;
            for( let elements in responseObj ) {
                if( responseObj[ elements ].additionalPropertiesMap2 && responseObj[ elements ].additionalPropertiesMap2.longName ) {
                    timeUnitsLinkList.push( {
                        staticDisplayValue: responseObj[ elements ].additionalPropertiesMap2.longName[ 0 ],
                        staticElementObject: 'cmdListView',
                        selected: currentTimeUnit === responseObj[ elements ].additionalPropertiesMap2.longName[ 0 ]
                    } );
                }
            }

            viewModelData.timeUnitsListDataProvider.selectionModel.setSelection( getSelectedTimeUnit( timeUnitsLinkList ) );
            return awPromise.resolve( timeUnitsLinkList );
        } );
    }
    for( let i = 0; i < inputData.length; i++ ) {
        timeUnitsLinkList.push( {
            staticDisplayValue: inputData[ i ].name,
            staticElementObject: 'cmdListView',
            selected: currentTimeUnit === inputData[ i ].name
        } );
    }
    viewModelData.timeUnitsListDataProvider.selectionModel.setSelection( getSelectedTimeUnit( timeUnitsLinkList ) );
    return awPromise.resolve( timeUnitsLinkList );
}

function getSelectedTimeUnit( timeUnitArray ) {
    return _.filter( timeUnitArray, function( timeUnit ) {
        return timeUnit.selected === true;
    } );
}

let exports = {};
export default exports = {
    getCurrentTimeUnitLong,
    getCurrentTimeUnitShort,
    getAvailableTimeUnits,
    changeTimeUnit,
    loadObjectData
};
