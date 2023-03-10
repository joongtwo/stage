// Copyright (c) 2022 Siemens

/**
 * @module js/PcaObjectTypeLOVComponentService
 */

import AwLovEdit from 'viewmodel/AwLovEditViewModel';

let exports = {};

/**
 * Render function for AwLovEdit
 * @param {Object} props context for render function interpolation
 * @returns {JSX.Element} React component
 */
export const awPcaObjectTypeLOVComponentRenderFunction = ( props ) => {
    const { viewModel, ...prop } = props;
    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.objTypeProvider;
    const passedProps = { ...prop, fielddata };
    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * Build SOA input to get the list of applicable/instanciable BO types
 * @param {String} selectedType entity object to query
 * @returns {Object} input object with detail on requested BO type and exclusion list
 */
export let getInputForApplicableTypes = function( selectedType ) {
    let inputDataList = [];
    let boType = '';
    let exclusionList = [];
    switch ( selectedType ) {
        case 'Cfg0FamilyGroup':
            boType = 'Cfg0AbsFamilyGroup';
            exclusionList = [];
            break;
        case 'Cfg0LiteralValueFamily':
            boType = 'Cfg0AbsFamily';
            exclusionList = [
                'Cfg0AbsFeature',
                'Cfg0AbsFeatureFamily',
                'Cfg0AbsEffectivityFamily',
                'Cfg0AbsFeatureSet',
                'Cfg0AbsModelFamily',
                'Cfg0AbsCompoundValueFamily'
            ];
            break;
        case 'Cfg0LiteralOptionValue':
            boType = 'Cfg0AbsValue';
            exclusionList = [
                'Cfg0AbsModel',
                'Cfg0AbsEffectivityIntent',
                'Cfg0AbsCompoundOptionValue'
            ];
            break;
        case 'Cfg0AbsConstraintRule':
            boType = 'Cfg0AbsRule';
            exclusionList = [
                'Cfg0AbsPackageRule', // Not supported
                'Cfg0AbsFreeFormRule', // Not supported
                'Cfg0FeasibilityRule' // Deprecated
            ];
            break;
        default:
            break;
    }

    let inputData = {
        boTypeName: boType,
        exclusionBOTypeNames: exclusionList
    };

    inputDataList.push( inputData );
    return inputDataList;
};

/**
 * Post process the SOA response and get the list of applicable BO types
 * @param {Object} response SOA response to be processed
 * @return {Array} list of applicable BO types
 */
export let processSoaResponseForBOTypes = function( response ) {
    let boTypes = [];
    if( response.output ) {
        for( let ii = 0; ii < response.output.length; ii++ ) {
            let displayableBOTypeNames = response.output[ ii ].displayableBOTypeNames;
            for( let jj = 0; jj < displayableBOTypeNames.length; jj++ ) {
                let boType = {
                    propDisplayValue: displayableBOTypeNames[ jj ].boDisplayName,
                    dispValue: displayableBOTypeNames[ jj ].boDisplayName,
                    propInternalValue: displayableBOTypeNames[ jj ].boName
                };
                boTypes.push( boType );
            }
        }
    }
    return boTypes;
};

/**
 * returns the existing lov's from cache, either from the parent's cache or the current one in case of component still being alive
 * @param {Array} list of vals
 * @param {Array} objectTypesCachedValues
 * @return {Array} list of vals
 */
export let getApplicableObjectTypesFromCache = function( listVals, objectTypesCachedValues ) {
    return listVals ? listVals : objectTypesCachedValues;
};

export default exports = {
    awPcaObjectTypeLOVComponentRenderFunction,
    getInputForApplicableTypes,
    processSoaResponseForBOTypes,
    getApplicableObjectTypesFromCache
};
