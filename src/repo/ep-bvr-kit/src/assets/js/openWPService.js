// Copyright (c) 2022 Siemens

/**
 * @module js/openWPService
 */
import dataMgmtService from 'soa/dataManagementService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';

/**
 * Evaluate the workpackage to verify compatibility to MBM alignment page
 * @param {Object} modelObject MECollaborationContext
 * @return {Object} promise
 */
export function evaluateToOpenWorkpackage( modelObject ) {
    let ebomPropName = 'mbm0EBOM';
    let mbomPropName = 'mbm0MBOM';
    let associatedCnPropName = 'mbm0AssociatedActiveCNs';
    let workPackageInfo = {
        workPackage: modelObject,
        isEbomMbomLinked: false,
        associatedCnObjects: []
    };

    return dataMgmtService.getPropertiesUnchecked( [ modelObject ], [ ebomPropName, mbomPropName, associatedCnPropName ] ).then( function( response ) {
        let loadedCcObj = cdm.getObject( modelObject.uid );
        let ebom = loadedCcObj ? loadedCcObj.props[ ebomPropName ] : null;
        let mbom = loadedCcObj ? loadedCcObj.props[ mbomPropName ] : null;
        let associatedCNs = loadedCcObj ? loadedCcObj.props[ associatedCnPropName ] : [];
        if( ebom && mbom && ebom.dbValues.length > 0 && !_.isEmpty( ebom.dbValues[ 0 ] ) && mbom.dbValues.length > 0 && !_.isEmpty( mbom.dbValues[ 0 ] ) ) {
            workPackageInfo.isEbomMbomLinked = true;
            _.forEach( associatedCNs.dbValues, function( uid ) {
                let cnObj = cdm.getObject( uid );
                if( cnObj ) {
                    let cmClosureRule = cnObj.props.CMClosure;
                    if( !cmClosureRule || cmClosureRule.dbValues[ 0 ] !== 'Closed' ) {
                        workPackageInfo.associatedCnObjects.push( cnObj );
                    }
                }
            } );
        }
        return workPackageInfo;
    } );
}

/**
 * Prepare data to show associated CN in the dropdown list of open popup
 * @param {Object} workPackageInfo data related to use in open Workpackage popup
 * @return {Object} Object
 */
export function prepareAssociatedCnOptions( workPackageInfo ) {
    const associatedCnObjects = [];
    _.forEach( workPackageInfo.associatedCnObjects, function( cn ) {
        associatedCnObjects.push( {
            propInternalValue: cn,
            propDisplayValue: cn.props.object_string.uiValues[ 0 ],
            iconName: cn.modelType.constantsMap.IconFileName
        } );
    } );

    return {
        associatedCnObjects: associatedCnObjects,
        optionPrepared: true,
        defaultOption: 'mbmOpenWithCnOption'
    };
}

/**
 * Update slelectoin
 * @param {Object} viewModel viewModel object
 * @param {String} currentSelection active radio button name
 * @param {String} prevSelection  previous active radio button name
 * @return {String} selected option
 */
export function mbmUpdateSelectedOption( viewModel, currentSelection, prevSelection ) {
    let data = { ...viewModel.getData() };
    let selectedOption = data[ currentSelection ];
    let value = selectedOption.dbValue || selectedOption.value;
    selectedOption.dbValues = [];
    selectedOption.dbValue = value;
    let previousSelectedOption = data[ prevSelection ];
    previousSelectedOption.dbValue = null;
    previousSelectedOption.dbValues = [];
    viewModel.dispatch( { path: 'data', value: data } );

    return value;
}

/**
 * Check if WP contains single product or EBOM,MBOM both.
 * @returns {Boolean} true if WP contains single product, false otherwise.
 */
function doesWPContainSingleProduct() {
    const preferences = appCtxSvc.getCtx('preferences');
    return preferences.EP_WorkPackageContentType.some( structureType => structureType.split(':')[0] === 'Product' );
}

/**
 * Prepare data to use in navigation of workpackage
 * @param {String} workPackage CCobject
 * @param {String} selectedCn selected Change Notice
 * @param {String} navigationType _self, newTab, newWindow
 * @param {String} mbmSelectedCnOption mbmOpenWithCnOption or mbmOpenWithoutCnOption
 * @return {Object} workpackage info required to navigate to MBM Alignment page
 */
export function processNavigation( workPackage, selectedCn, navigationType, mbmSelectedCnOption ) {
    /*
    Adding the MCN in the  workpackageInfo if the selected CN has the implements property
    if the EP_SplitChangeNotice is mbom , then in that case there will be mcn
    but if the preference is not there , then mcn (trackingcn) will be same as ecn (selected)
    and if the Pref is MBOM and mcn is empty then show error message .
    */
    const preferences = appCtxSvc.getCtx('preferences');
    const ebomStructure = appCtxSvc.getCtx('epTaskPageContext.ebomStructure');
    const mbomStructure = appCtxSvc.getCtx('epTaskPageContext.mbomStructure');
    if( selectedCn && selectedCn.uid && mbmSelectedCnOption === 'mbmOpenWithCnOption' && !doesWPContainSingleProduct() && ebomStructure && mbomStructure ) {
        let tracking_cn = cdm.getObject( selectedCn.uid );
        let cnObj = tracking_cn.props.CMImplements ? tracking_cn.props.CMImplements.dbValues[ 0 ] : null;
        if( preferences.EP_SplitChangeNotice && preferences.EP_SplitChangeNotice[ 0 ] === 'MBOM' && cnObj === undefined ) {
            return {
                error: true,
                selectedCN: selectedCn
            };
        }
        if( cnObj ) {
            let impacting_cn = cdm.getObject( cnObj );
            return {
                workPackage: workPackage,
                navigationType: navigationType,
                selectedCN: impacting_cn,
                selectedMCN: tracking_cn
            };
        }
    }
    return {
        workPackage: workPackage,
        navigationType: navigationType,
        selectedCN: selectedCn,
        selectedMCN: selectedCn
    };
}

export default {
    evaluateToOpenWorkpackage,
    prepareAssociatedCnOptions,
    mbmUpdateSelectedOption,
    processNavigation
};
