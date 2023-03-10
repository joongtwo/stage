// Copyright (c) 2022 Siemens

/**
 * @module js/massUpdateService
 */
import appCtxSvc from 'js/appCtxService';
import cmdPanelSvc from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';

let exports = {};

/**
 * Returns the selected problem Item
 *
 * @param {data} data viewDataModel
 * @param {appCtxSvc} ctx context
 * @return {IModelObject} The selected Problem Item
 */
export let getClipboardFavouriteRecentSelectedItem = function( sourceObjects ) {
    let selectedItem = {};

    if( sourceObjects.length > 0 ) {
        selectedItem = sourceObjects[ 0 ];
    }

    return selectedItem;
};

/**
 * Update Display of Problem Item Link
 *
 * @param {data} data viewModel of view
 * @param {String} path path for link property
 * @param {String} value to be updated
 */
export let updateProblemItemLinkInViewModel = function( problemItemProp, value ) {
    if( value !== undefined ) {
        let newProblemItemProp = _.clone( problemItemProp );
        newProblemItemProp.dbValue = value.dbValue;
        newProblemItemProp.displayName = value.displayName;
        newProblemItemProp.uiValue = value.dbValue;

        let currentProblemItem = appCtxSvc.getCtx( 'problemItemProp' );
        if ( currentProblemItem ) {
            appCtxSvc.updateCtx( 'problemItemProp', newProblemItemProp );
        } else {
            appCtxSvc.registerCtx( 'problemItemProp', newProblemItemProp );
        }
        return newProblemItemProp;
    }
};

/**
 * Processes the responce of expandGRMRelationsForPrimary and returns list of secondary Objects
 *
 * @param {responce}response responce of expandGRMRelationsForPrimary
 * @returns {List} availableSecondaryObject return list of secondary objects
 */
export let processSecondaryObject = function( response ) {
    let availableSecondaryObject = [];
    if( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
        for( let i in response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
            availableSecondaryObject[ i ] = response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ i ].otherSideObject;
        }
    }
    return availableSecondaryObject;
};

/**
 * Opens the Command Panel
 *
 * @param {String} commandId: MassUpdate
 * @param {String} location of Panel
 */
export let openSelectProblemPanel = function( commandId, location ) {
    cmdPanelSvc.activateCommandPanel( commandId, location );
};

/**
 * Set selected/attached Problem Item in app context
 *
 * @param { IModelObject } problemItem Item
 */
export let setProblemItem = function( problemItem ) {
    if( problemItem ) {
        problemItem.props.object_string.propertyLabelDisplay = 'NO_PROPERTY_LABEL';
    }
    let currentProblemItem = appCtxSvc.getCtx( 'problemItem' );
    if ( currentProblemItem ) {
        appCtxSvc.updateCtx( 'problemItem', problemItem );
    } else {
        appCtxSvc.registerCtx( 'problemItem', problemItem );
    }

    eventBus.publish( 'ImpactedAssembliesPanel.setSelectedProblemProp' );
};

/**
 * Reset the value of link display value
 *
 * @param {data} data viewModel of view
 * @param { property } resetProp reseting to orignal values of prop
 */
export let clear = function( data, resetProp ) {
    let currentProblemItem = appCtxSvc.getCtx( 'problemItem' );
    if ( currentProblemItem ) {
        appCtxSvc.updateCtx( 'problemItem', undefined );
    } else {
        appCtxSvc.registerCtx( 'problemItem', undefined );
    }

    //Reset link to no Problem Item selected
    let newProblemItemProp = exports.updateProblemItemLinkInViewModel( data.problemItemProp, resetProp );

    return { problemItemList: [], problemItemProp: newProblemItemProp };
};

export let isProblemItemReusable = function( response ) {
    let reusable = true;

    if( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
        for( let i in response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
            if( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ i ].otherSideObject.props.CMClosure.dbValues[ 0 ] !== 'Closed' &&
                response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ i ].otherSideObject.props.CMClosure.dbValues[ 0 ] !== 'Canceled' ) {
                reusable = false;
                break;
            }
        }
    }

    return reusable;
};

export default exports = {
    getClipboardFavouriteRecentSelectedItem,
    updateProblemItemLinkInViewModel,
    processSecondaryObject,
    openSelectProblemPanel,
    setProblemItem,
    clear,
    isProblemItemReusable
};
