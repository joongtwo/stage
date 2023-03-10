// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';


/**
 * @module js/epBalancingSelectionService
 */

/**
 * updateStationsListOnProcessResourceSelectionChange
 * @param {*} prListSelectionData  prListSelectionData
 * @param {*} stationListPrSelectionData  stationListPrSelectionData
 * @param {*} station  station
 */
export function updateStationsListOnProcessResourceSelectionChange( prListSelectionData, stationListPrSelectionData, station ) {
    if( !_.isEmpty( prListSelectionData ) ) {
        let newSelectionData = _.clone( prListSelectionData );
        newSelectionData.changedStationDuePrSelectionFlag = !( stationListPrSelectionData.station && stationListPrSelectionData.station.uid === station.uid );
        newSelectionData.station = station;
        newSelectionData.selected = [ prListSelectionData ];
        stationListPrSelectionData.update( newSelectionData );
    }
}
/**
 *
 * @param {Object} dataProvider - data provider
 * @param {Object} stationAndPr - station and pr selection
 * @param {object} pageContext - page ctx
 */
export function updateSelectionLocalStorage( dataProvider, stationAndPr, pageContext ) {
    if ( stationAndPr.station !== 0 && stationAndPr.pr !== 0  && stationAndPr.station !== undefined && stationAndPr.pr !== undefined   && stationAndPr.changedStationDuePrSelectionFlag !== undefined ) {
        const selection = new Object();
        selection.stationUid = stationAndPr.station ? stationAndPr.station.uid : null;
        selection.prUid = stationAndPr.pr ? stationAndPr.pr.uid : null;

        localStorage.setItem( dataProvider.name + pageContext.uid, JSON.stringify( selection ) );
    }
}
/**
 *
 * @param {Object} dataProvider - data provider
 * @param {Object} station - station atomic data
 * @param {Object} pr - pr atomic data
 * @param {object} pageContext - page ctx
 */
export function loadSelectionFromLocalStorage( dataProvider, station, pr, pageContext ) {
    const selectionString = localStorage.getItem( dataProvider.name + pageContext.uid );
    if ( selectionString ) {
        const selection = JSON.parse( selectionString );
        const selectionStation = cdm.getObject( selection.stationUid );
        const selectionPr = cdm.getObject( selection.prUid );
        const newSelectionData = selectionPr ?  _.clone(  selectionPr ) : new Object();

        newSelectionData.changedStationDuePrSelectionFlag = selectionPr !== null;
        newSelectionData.station = selectionStation;
        newSelectionData.selected = [ selectionPr ];
        pr.update( newSelectionData );
    }
}


/**
 *
 * @param {Object} prSelectionData atomic data object to clear pr selection  flag
 */
export function clearPrSelectionData( prSelectionData ) {
    if ( prSelectionData ) {
        prSelectionData.update( null );
    }
}
/**
 *
 * @param {Object} stationAndPrSelection object include flag
 * @returns {Object} stationAndPrSelection
 */
export function clearChangedStationDuePrSelectionFlag( stationAndPrSelection ) {
    stationAndPrSelection.changedStationDuePrSelectionFlag = false;
    return stationAndPrSelection;
}
/**
 *
 * @param {Object} station  new station
 * @param {Object} pr  new processResource
 * @param {Object} changedStationDuePrSelectionFlag flag indicate if user click on pr in different selected station
 * @returns {Object} new selection
 */
export function updateStationAndPrSelection( station, pr, changedStationDuePrSelectionFlag ) {
    station ? station.selectedOperator = [ pr ] : '';
    return {
        station : station,
        pr : pr,
        changedStationDuePrSelectionFlag
    };
}


export default {
    updateStationsListOnProcessResourceSelectionChange,
    updateStationAndPrSelection,
    clearChangedStationDuePrSelectionFlag,
    clearPrSelectionData,
    updateSelectionLocalStorage,
    loadSelectionFromLocalStorage

};
