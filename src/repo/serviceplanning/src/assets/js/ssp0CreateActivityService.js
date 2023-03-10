// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to activities tree
*
* @module js/ssp0CreateActivityService
*/

import _ from 'lodash';

var exports = {};

/**
 * Get the List of Service Containers
 * @param {Object} data data
 * @return {Object} List of Service Containers
 */
export let activityList = function( data ) {
    let activitiesList = [];
    if ( data.searchResults ) {
        var activityNames = data.searchResults;
        for ( let i = 0; i < activityNames.length; i++ ) {
            let dbValue = activityNames[i].props.type_name.dbValues[0];
            let uiValue = activityNames[i].props.type_name.uiValues[0];

            activitiesList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
    }
    return activitiesList;
};

/**
 * Clone the type of Selected Object into the data
 * @param {Object} data data
 * @return {Object} an object for given context
 */
export let changeAction = function( data ) {
    let cloneData = _.clone( data );
    if ( cloneData.totalFound === 0 ) {
        cloneData.selectedType.dbValue = 'MEActivity';
    } else {
        cloneData.selectedType.dbValue = data.currentActivity.dbValue.propInternalValue;
    }

    return cloneData;
};

export default exports = {
    activityList,
    changeAction
};
