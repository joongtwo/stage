// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* eslint-env jest */

/**
 * @module js/epSearchObjectService
 */

import preferenceSvc from 'soa/preferenceService';
import _ from 'lodash';

/**
 * buildStringFilter
 * @param {*} stringValue string value for string filter
 * @returns {Object} string filter
 */
function buildStringFilter( stringValue ) {
    return {
        searchFilterType: 'StringFilter',
        stringValue
    };
}

/**
 * Process SOA Response and creates array of business objects returned by SOA
 * @param {Object} response SOA Response
 * @return {object} returns array of business object
 */
export function processSoaResponseForBOTypes( { output = [] } = {} ) {
    return _.flatten( _.map( output, element =>
        _.map( element.displayableBOTypeNames, displayableBOTypeName =>
            buildStringFilter( displayableBOTypeName.boName ) )
    ) );
}

/**
 * getSpecifiedObjectType
 * sets subBusinessObjects on data if context has objectTypesToSearch.
 * @param {String} searchBoxValue value of search box
 * @param {Array} objectTypesToSearch object types to search
 * @returns {Array} array of filters according to value and types
 */
export function getSpecifiedObjectType( searchBoxValue, objectTypesToSearch ) {
    if( searchBoxValue !== '' && objectTypesToSearch && !_.isEmpty( objectTypesToSearch ) ) {
        return _.map( objectTypesToSearch, objectTypeToSearch => buildStringFilter( objectTypeToSearch ) );
    }
    return null;
}

/**
 * Sets selectedObject on data
 * @param {Object} newSelection the new selection
 * @returns {Object} the new selection
 */
export function updateSelectionOnData( newSelection ) {
    return {
        selectedObject: newSelection
    };
}

/**
 * This method returns the type of object to be added based on preference
 * @param { String } preferenceSuffixForTypesToSearch - Suffix for types to search preference
 * @returns {Promise} preferences promise - string filters for the preference value
 */
function getSearchTypesFromPreference( preferenceSuffixForTypesToSearch ) {
    const prefName = `EP_SearchSubtypesFor${preferenceSuffixForTypesToSearch}`;

    return preferenceSvc.getStringValues( [ prefName ] )
        .then( ( values = [] ) => {
            return _.map( values, value => buildStringFilter( value ) );
        } );
}

export default {
    processSoaResponseForBOTypes,
    getSpecifiedObjectType,
    updateSelectionOnData,
    getSearchTypesFromPreference
};
