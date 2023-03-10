// Copyright (c) 2022 Siemens

/**
 * Module for Header Contribution
 *
 * @module js/Ewi0HeaderContributionService
 */
import _ from 'lodash';

/**
 * Define public API
 */
var exports = {};

/**
 * Set EWI header properties from preference
 *
 * @param {ObjectArray} headerProps EWI header properties name and value from preference
 *
 * @return {ObjectArray} headerPropsList the header properties to display
 */
export let updateHeaderProps = function( headerProps ) {
    var headerPropsList = [];
    _.forEach( headerProps, function( currentProp ) {
        var propValue = currentProp.propertyValue;
        // Only add the property if the value is not empty
        if( !_.isEmpty( propValue ) ) {
            let configData = {
                type: 'STRING',
                dbValue: '',
                propertyDisplayName: currentProp.propertyName,
                uiValue: propValue,
                renderingHint : currentProp.propertyName + ': ' + currentProp.propertyValue,
                isNull: 'false'
            };
            headerPropsList.push( configData );
        }
    } );
    return headerPropsList;
};

/**
 * A glue code to support Ewi0HeaderContributionService
 *
 * @param {Object} $timeout - $timeout service
 *
 * @return {Object} - Service instance
 *
 * @member Ewi0HeaderContributionService
 */

export default exports = {
    updateHeaderProps
};
