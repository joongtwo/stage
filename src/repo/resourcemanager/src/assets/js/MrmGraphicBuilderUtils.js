// Copyright (c) 2022 Siemens

/**
 * @module js/MrmGraphicBuilderUtils
 */
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';

var exports = {};

var admin_2012_09_Pref_Management = 'Administration-2012-09-PreferenceManagement';
/*
Following API will form message to be presented to user from the response of checkToolParameters SOA.
The message to be presented to the user is the data which is present in report element of the response
*/
export let formUserResponseForToolChecker = function( response ) {
    for( var iCheckResultIndex = 0; iCheckResultIndex < response.checkResults.length; iCheckResultIndex++ ) {
        var userResponse = '';
        for( var iReportIndex = 0; iReportIndex < response.checkResults[ iCheckResultIndex ].report.length; iReportIndex++ ) {
            if( iReportIndex !== 0 ) {
                //Add new line character at the start of the line if it is not present.
                if( response.checkResults[ iCheckResultIndex ].report[ iReportIndex ].indexOf( '\n' ) !== 0 ) {
                    userResponse += '\n' + response.checkResults[ iCheckResultIndex ].report[ iReportIndex ];
                } else {
                    userResponse += response.checkResults[ iCheckResultIndex ].report[ iReportIndex ];
                }
            } else {
                userResponse += response.checkResults[ iCheckResultIndex ].report[ iReportIndex ];
            }
        }
    }
    return userResponse;
};

export let getAccuracyPrefAndSetSimplified = function( setSimplified ) {
    var orgPref = '';
    soaService.post( admin_2012_09_Pref_Management, 'getPreferences', {
        preferenceNames: [ 'MRMHolderDataAccuracy' ],
        includePreferenceDescriptions: false
    } ).then( function( response ) {
        orgPref = response.response[ 0 ].values.values;
    } );

    if( setSimplified === true ) {
        setAccuracyPref( 'Simplified' );
    } else {
        setAccuracyPref( '' );
    }
    return orgPref;
};

export let setAccuracyPref = function( prefValue ) {
    var prefValuesList = [];
    prefValuesList.push( prefValue );
    let preferenceInput = [ {
        preferenceName: 'MRMHolderDataAccuracy',
        values: prefValuesList
    } ];
    soaService.post( admin_2012_09_Pref_Management, 'setPreferences2', {
        preferenceInput: preferenceInput
    } );
};

export default exports = {
    formUserResponseForToolChecker,
    getAccuracyPrefAndSetSimplified,
    setAccuracyPref
};
