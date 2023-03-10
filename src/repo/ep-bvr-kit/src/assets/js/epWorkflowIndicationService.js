// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * This service helps attach a workflow indication to an vmo.
 *
 * @module js/epWorkflowIndicationService
 */
import _ from 'lodash';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';


/**
 * Add the workflow indication to the passed VMO
 * @param {viewModelObject} vmo - a given viewModelObject
 */
function updateVmoToWorkflow( vmo ) {
    let imageName;
    let indicator = {
        tooltip: '',
        image: ''
    };
    let resource = 'WorkflowMessages';
    let localTextBundle = localeService.getLoadedText( resource );
    let inWorkflowName = vmo.props[ epBvrConstants.BL_REV_ALLWORKFLOW ] ? vmo.props[ epBvrConstants.BL_REV_ALLWORKFLOW ].uiValues[0] : null;
    let relWorkflowName = vmo.props[ epBvrConstants.LAST_RELEASE_STATUS_ATTR ] ? vmo.props[ epBvrConstants.LAST_RELEASE_STATUS_ATTR ].uiValues[0] : null;
    let status = getWorkflowStatus( vmo );
    vmo.indicators = [];

    switch ( status ) {
        case 'Released':
            imageName =  iconSvc.getTypeIconFileUrl( releaseIcon );
            indicator.image = imageName + '.svg';
            indicator.tooltip = localTextBundle.ReleasedStatusTooltip + ' ' + relWorkflowName;
            vmo.indicators.push( { release:indicator } );
            break;

        case 'InaWorkflow':
            imageName =  iconSvc.getTypeIconFileUrl( workflowIcon );
            indicator.image = imageName + '.svg';
            indicator.tooltip = localTextBundle.InWorkflowTooltip + ' ' + inWorkflowName;
            vmo.indicators.push( { workflow:indicator } );
            break;

        case 'ReleasedAndInaWorkflow':
            imageName =  iconSvc.getTypeIconFileUrl( releaseIcon );
            indicator.image = imageName + '.svg';
            indicator.tooltip = localTextBundle.ReleasedStatusTooltip + ' ' + relWorkflowName;
            vmo.indicators.push( { release: Object.assign( {}, indicator ) } );
            imageName =  iconSvc.getTypeIconFileUrl( workflowIcon );
            indicator.image = imageName + '.svg';
            indicator.tooltip = localTextBundle.InWorkflowTooltip + ' ' + inWorkflowName;
            vmo.indicators.push( { workflow:indicator } );
            break;

        default:
            break;
    }
    return vmo;
}

/**
 * Add the workflow indication to the passed VMO
 * @param {viewModelObject} vmo - a given viewModelObject
 */
function updateVmosToWorkflow( vmoArray ) {
    vmoArray.forEach( ( vmo ) => {
        updateVmoToWorkflow( vmo );
    } );
}

/**
 * Get the workflow status from the VMO using properties on VMO
 * @param {viewModelObject} vmo - a given viewModelObject
 */
function getWorkflowStatus( vmo ) {
    let status = null;
    let ObjectIsInWorkflowFlag = false;
    let ObjectHasreleaseStatusFlag = false;
    let inProcessProperty = vmo.props[ epBvrConstants.IN_PROCESS ] ? vmo.props[ epBvrConstants.IN_PROCESS ].dbValues : null;

    if( inProcessProperty !== null && inProcessProperty[0].toLowerCase() === 'true'  ) {
        ObjectIsInWorkflowFlag = true;
    }
    let releaseStatusProperty = vmo.props[ epBvrConstants.LAST_RELEASE_STATUS_ATTR ] ? vmo.props[ epBvrConstants.LAST_RELEASE_STATUS_ATTR ].dbValues : null;

    if( releaseStatusProperty !== null && releaseStatusProperty.length > 0 && releaseStatusProperty[0] !== '' ) {
        ObjectHasreleaseStatusFlag = true;
    }
    if( ObjectIsInWorkflowFlag && ObjectHasreleaseStatusFlag ) {
        status = workflowIndicationStatus.ReleasedAndInaWorkflow;
    } else if( ObjectIsInWorkflowFlag && !ObjectHasreleaseStatusFlag ) {
        status = workflowIndicationStatus.InaWorkflow;
    } else if( !ObjectIsInWorkflowFlag && ObjectHasreleaseStatusFlag ) {
        status = workflowIndicationStatus.Released;
    }
    return status;
}

let exports = {};

const releaseIcon = 'indicatorReleased16';
const workflowIcon = 'indicatorWorkflow16';

const workflowIndicationStatus = {
    NoWorkflowStatus : 'NoWorkflowStatus',
    Released : 'Released',
    NoWorInaWorkflowkflowStatus : 'InaWorkflow',
    ReleasedAndInaWorkflow : 'ReleasedAndInaWorkflow',
    InaWorkflow: 'InaWorkflow'
};
export default exports = {
    updateVmoToWorkflow,
    updateVmosToWorkflow
};
