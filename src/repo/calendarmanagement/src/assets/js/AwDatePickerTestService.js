

// Copyright (c) 2022 Siemens

/**
 * @module js/AwDatePickerTestService
 */

var exports = {};

export let getCurrentDate = function( atomicDataRef ) {
    //initializing the i18n values here since these are not available inside the load column function

    var currentDate = new Date();


    return {
        sampleJsonData: currentDate
    };
};
/**
 * This method is used to get the LOV values of timezone for the add project panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getTimezoneList = function( response ) {
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propDisplayDescription: obj.propDisplayValues.lov_value_descriptions ? obj.propDisplayValues.lov_value_descriptions[ 0 ] : obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );
};
export default exports = {
    getCurrentDate,
    getTimezoneList
};
