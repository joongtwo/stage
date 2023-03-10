// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ctm1ContentMgmtDMCodeService
 */
var exports = {};

/**
 * Get SOA input for DM code default values
 * @param {object} ctx context
 * @returns {object} input data to soa operation
 */
export let getSNSInputs = function( ctx ) {
    var input = [];
    var selectedBOMLInes = ctx.ctm1bomlines;

    var inp = {
        clientId: 'SNSDefaultValues-awc',
        object: selectedBOMLInes[0]
    };

    input.push( inp );
    return input;
};

/**
 * Get SOA operation input for DM information code
 * @param {object} data declarative view model data
 * @param {object} ctx context
 * @return {object} input data to soa operation
 */
export let getSNSInputsForInfoCode = function( data, ctx ) {
    var input = [];
    var selectedBOMLInes = ctx.ctm1bomlines;

    var inp = {
        clientId: 'infocode-awc',
        object: selectedBOMLInes[0],
        keyValueArgs: {
            Type: 'InfoCodes',
            TopicType: data.revision__ctm0TopicTypeTagref.displayValues[0]
        }
    };

    input.push( inp );
    return input;
};

/**
 * set DM default value code
 * @param {object} ctx context object
 */
export let setDefaultValuesForDMCode = function( ctx ) {
    if ( ctx.ctm1snscodes && ctx.ctm1snscodes.data && ctx.ctm1snscodes.data[ 0 ].defaultValueMap ) {
        var defaultValueMap = ctx.ctm1snscodes.data[ 0 ].defaultValueMap;
        return { revision__skdmodelic: { dbValue: defaultValueMap.skdmodelic }, revision__skdsdc: { dbValue: defaultValueMap.skdsdc }, revision__skdchapnum: { dbValue: defaultValueMap.skdchapnum },
            revision__skdsection: { dbValue: defaultValueMap.skdsection }, revision__skdsubsection: { dbValue: defaultValueMap.skdsubsection },
            revision__skdsubject: { dbValue: defaultValueMap.skdsubject }, revision__skddiscode: { dbValue: defaultValueMap.skddiscode },
            revision__skddiscodev: { dbValue: defaultValueMap.skddiscodev }, revision__skdincodev: { dbValue: 'A' } };
    }
};

/**
 * set additional DM code default values.
 * @param {object} ctx context object
 */
export let setOtherDefaultValuesForDMCode = function( ctx ) {
    if ( ctx.ctm1snscodes && ctx.ctm1snscodes.data && ctx.ctm1snscodes.data[ 0 ].defaultValueMap ) {
        var defaultValueMap = ctx.ctm1snscodes.data[ 0 ].defaultValueMap;
        return { revision__skdsecurity_class: { dbValue: defaultValueMap.skdsecurity_class },
            revision__civ0rpcname: { dbValue: defaultValueMap.civ0rpcname }, revision__civ0origname: { dbValue: defaultValueMap.civ0origname },
            revision__skdrpc: { dbValue: defaultValueMap.skdrpc }, revision__skdorig: { dbValue: defaultValueMap.skdorig } };
    }
};

/**
 * Get info code from soa response.
 * @param {object} response soa response.
 * @returns {Array} an array of information codes.
 */
export let getInfoCodes = function( response ) {
    var codes = [];

    if ( response.data ) {
        var defaultValueMap = response.data[ 0 ].defaultValueMap;
        if ( defaultValueMap ) {
            codes = Object.keys( defaultValueMap );
        }
    }

    return codes;
};

/**
 * Get information code list
 * @param {object} ctx context object
 * @returns {Array} a list of information code.
 */
export let getInfoCodeList = function( ctx ) {
    var codeList = [];

    if ( ctx.ctm1snsinfocodes ) {
        var defaultValueMap = ctx.ctm1snsinfocodes.data[ 0 ].defaultValueMap;
        if ( defaultValueMap ) {
            var codes = Object.keys( defaultValueMap );
            for ( let i = 0; i < codes.length; i++ ) {
                let codeObj = {
                    propDisplayValue: codes[i],
                    propInternalValue: codes[i]
                };
                codeList.push( codeObj );
            }
        }
    }

    return codeList;
};

/**
 * Update info code field.
 * @param {object} ctx context object
 */
export let updateInfoCodes = function( ctx ) {
    if ( ctx.ctm1snsinfocodes &&  ctx.ctm1snsinfocodes.length > 0 ) {
        return { revision__skdincode: { dbValue : ctx.ctm1snsinfocodes[0] } };
    }
};

/**
 * Ctm1ContentMgmtDMCodeService factory
 */

export default exports = {
    getSNSInputs,
    getSNSInputsForInfoCode,
    setDefaultValuesForDMCode,
    setOtherDefaultValuesForDMCode,
    updateInfoCodes,
    getInfoCodes,
    getInfoCodeList
};
