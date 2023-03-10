// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * navigation service for EasyPlan objects.
 *
 * @module js/epNavigationService
 */
import _ from 'lodash';
import AwStateService from 'js/awStateService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import navigationSvc from 'js/navigationService';
import soaService from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import dataMgmtService from 'soa/dataManagementService';


const SHOW_OBJECT_STATE = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
const MANAGE_PAGE_STATE = 'manageWorkPackageNew';
const CLOSURE_RULE = 'ClosureRule';
let showObjectPolicyForPlant = null;


/**
 * Navigating object new tab OR new window
 *
 * @param {string} stateName - given state name
 * @param {string} navigationParams - given uid
 * @param {string} navigateIn - the string which states if we want to navigate to a newTab or newWindow
 */
function navigate( stateName, navigationParams, navigateIn ) {
    const action = {
        actionType: 'Navigate',
        navigateTo: stateName
    };

    if( navigateIn ) {
        action.navigateIn = navigateIn;
    }

    navigationSvc.navigate( action, navigationParams );
}

/**
 * Close left panel
 */
export function closeSideNavPanel() {
    const sidenavCommand = appCtxService.getCtx( 'sidenavCommandId' );
    if( sidenavCommand ) {
        eventBus.publish( 'awsidenav.openClose', {
            id: 'aw_navigation',
            commandId: sidenavCommand
        } );
    }
}


/**
 * This method navigates to manage page
 * @param { Object } objectToNavigate object to navigate
 * @param { Object } navigateIn - the string which states if we want to navigate to a newTab or newWindow
 */
export function navigateToManagePage( objectToNavigate, navigateIn ) {
    navigate( MANAGE_PAGE_STATE, { uid: objectToNavigate.uid, mcn: AwStateService.instance.params.mcn }, navigateIn );
}


/**
 * Navigate to showObject page with all the required configurations loaded
 * @param {Object} epObjectToNavigate epObjectToNavigate
 * @returns {Promise} promise object
 */
function navigateToShowObjectPage( epObjectToNavigate ) {
    /* Need to register below property policy so that ACE page honors the loaded
    properties while loading the page and does not override with default property values */
    showObjectPolicyForPlant = {
        types: [ {
            name: 'Awb0ProductContextInfo',
            properties: [ {
                name: 'awb0Product'
            },
            {
                name: 'awb0CurrentRevRule'
            },
            {
                name: 'awb0SupportedFeatures'
            },
            {
                name: 'awb0EffDate'
            },
            {
                name: 'awb0EffEndItem',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0EffUnitNo'
            },
            {
                name: 'awb0EffectivityGroups'
            },
            {
                name: 'awb0VariantRules'
            },
            {
                name: 'awb0VariantRuleOwningRev'
            },
            {
                name: 'awb0ClosureRule'
            }
            ]
        } ]
    };
    policySvc.register( showObjectPolicyForPlant );
    const epTaskPageContext = appCtxService.getCtx("epTaskPageContext");
    let soaInput = {
        inputData: {
            product: {
                uid: epObjectToNavigate.props[ epBvrConstants.BL_REVISION ].dbValues[ 0 ],
                type: epObjectToNavigate.props[ epBvrConstants.BL_REV_OBJECT_TYPE ].dbValues[ 0 ]
            },
            config: {
                revisionRule: {
                    uid: appCtxService.ctx.ep.plantStructureInfo.uid,
                    type: appCtxService.ctx.ep.plantStructureInfo.type
                },
                closureRule: {
                    uid: epTaskPageContext.plantPCI.props.awb0ClosureRule.dbValues[0],
                    type: CLOSURE_RULE
                }
            }
        }
    };
    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', soaInput ).then(
        function( response ) {
            policySvc.unregister( showObjectPolicyForPlant );
            const prodContextInfo = response.ServiceData.modelObjects[ response.rootProductContext.uid ];
            navigate( SHOW_OBJECT_STATE, {
                uid: epObjectToNavigate.props[ epBvrConstants.BL_REVISION ].dbValues[ 0 ],
                pci_uid: prodContextInfo.uid,
                cc_uid: appCtxService.ctx.epPageContext.collaborationContext.uid
            } );
        } );
}

/**
 * Evaluate the check if the Workpackage is associated to any CN.
 * @param {Object} modelObject MECollaborationContext
 * @return {Object} promise
 */
export let evaluateToOpenWorkpackage = function( modelObject ) {
    let associatedCnPropName = 'mbm0AssociatedActiveCNs';
    let workPackageInfo = {
        workPackage: modelObject,
        associatedCnObjects: []
    };

    return dataMgmtService.getProperties( [ modelObject.uid ], [ associatedCnPropName ] ).then( function( response ) {
        let loadedCcObj = cdm.getObject( modelObject.uid );
        let associatedCNs = loadedCcObj ? loadedCcObj.props[ associatedCnPropName ] : [];
        if( associatedCNs && associatedCNs.dbValues.length > 0 ) {
            associatedCNs.dbValues.forEach( uid => {
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
};

/**
 * Open given object in same state in new tab/window with different configuration
 * @param {Object} objectToNavigateUid objectToNavigateUid
 * @param {String} navigateIn navigateIn
 * @param {Boolean} ignoreMCN ignoreMCN
 */
export function navigteToSameStateWithDifferentConfiguration( objectToNavigateUid, navigateIn, ignoreMCN = false ) {
    const tracking_cn = ignoreMCN ? null : AwStateService.instance.params.tracking_cn;
    const impacting_cn = ignoreMCN ? null : AwStateService.instance.params.tracking_cn;
    const navigationParams = {
        uid: objectToNavigateUid,
        mcn: AwStateService.instance.params.mcn,
        tracking_cn: tracking_cn,
        impacting_cn: impacting_cn
    };
    navigate( AwStateService.instance.current.name, navigationParams, navigateIn );
}

/**
 * Navigate to AuthorBOE task page
 *
 * @param {Object} epObjectToNavigate epObjectToNavigate
 *
 * @returns {Promise} promise object
 */
export function navigateToAuthorBOETask( epObjectToNavigate ) {
    if( !epObjectToNavigate.props[ epBvrConstants.BL_REVISION ] || !epObjectToNavigate.props[ epBvrConstants.BL_REV_OBJECT_TYPE ] ) {
        return dataMgmtService.getProperties( [ epObjectToNavigate.uid ], [ epBvrConstants.BL_REVISION, epBvrConstants.BL_REV_OBJECT_TYPE ] ).then( function() {
            epObjectToNavigate = cdm.getObject( epObjectToNavigate.uid );
            return navigateToShowObjectPage( epObjectToNavigate );
        } );
    }
    return navigateToShowObjectPage( epObjectToNavigate );
}

export default {
    closeSideNavPanel,
    navigateToManagePage,
    evaluateToOpenWorkpackage,
    navigteToSameStateWithDifferentConfiguration,
    navigateToAuthorBOETask
};
