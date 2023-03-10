// Copyright (c) 2022 Siemens

/**
 * @module js/aceBreadcrumbService
 */
import cdm from 'soa/kernel/clientDataModel';
import ctxStateMgmtService from 'js/contextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};

export let _onSelectCrumb = function( occContext, crumb ) {
    exports.onSelectBreadcrumb( crumb, occContext );
};

export let getSelectionForBreadcrumb = function( selections, baseSelection ) {
    var selectedObjects = [];
    if( selections && selections.length > 0 ) {
        selectedObjects = selections;
    } else if( baseSelection ) {
        selectedObjects = [ baseSelection ];
    }

    return selectedObjects.map( ( selection ) => {
        return cdm.getObject( selection.uid );
    } );
};

/**
 * insertCrumbsFromModelObject
 *
 * @param {IModelObject} modelObject - model object
 * @param {Object} breadCrumbProvider - bread crumb provider
 * @return {Object} bread crumb provider
 */
export let insertCrumbsFromModelObject = function( modelObject, breadCrumbProvider, occContext ) {
    if( modelObject && modelObject.props && modelObject.props.object_string && breadCrumbProvider ) {
        var props = modelObject.props;
        var crumb = {
            displayName: props.object_string.uiValues[ 0 ],
            showArrow: props.awb0NumberOfChildren ? props.awb0NumberOfChildren.dbValues[ 0 ] > 0 : true,
            selectedCrumb: false,
            scopedUid: modelObject.uid,
            clicked: false,
            occContext: occContext,
            onCrumbClick: ( crumb ) => _onSelectCrumb( occContext, crumb )
        };

        breadCrumbProvider.crumbs.splice( 0, 0, crumb );

        var parentUid = occmgmtUtils.getParentUid( modelObject );
        if( parentUid ) {
            var parentModelObj = cdm.getObject( parentUid );

            if( parentModelObj ) {
                return exports.insertCrumbsFromModelObject( parentModelObj, breadCrumbProvider, occContext );
            }
        } else {
            // When the root object is not type of Awb0Element
            if( modelObject.modelType && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) === -1 ) {
                var openedObject = cdm.getObject( occContext.currentState.uid );
                // And the root object is not the opened object
                if( openedObject !== modelObject ) {
                    // Add the opened object as the first node of the breadcrumb
                    var crumbOpenedObject = {
                        displayName: openedObject.props.object_string.uiValues[ 0 ],
                        showArrow: true,
                        selectedCrumb: false,
                        scopedUid: openedObject.uid,
                        clicked: false,
                        occContext: occContext,
                        onCrumbClick: ( crumb ) => _onSelectCrumb( occContext, crumb )
                    };

                    breadCrumbProvider.crumbs.splice( 0, 0, crumbOpenedObject );
                }
            }
        }
    }
    return breadCrumbProvider;
};

/**
 * @param {Object} selectedCrumb - selected crumb object
 * @param {String} occContext - occContext
 */
export let onSelectBreadcrumb = function( selectedCrumb, occContext ) {
    var elementToSelect = cdm.getObject( selectedCrumb.scopedUid );
    let selectionsToModify = {};

    if( elementToSelect.modelType && elementToSelect.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) === -1 && occContext.selectedModelObjects.length === 1 ) {
        selectionsToModify.clearExistingSelections = true;
    } else {
        selectionsToModify = {
            elementsToSelect: [ elementToSelect ]
        };
    }
    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
};

/**
 * buildNavigateBreadcrumb
 *
 * @param {IModelObject} selectedObjects - selected model objects
 * @return {Object} breadCrumbProvider bread crumb provider
 */
export let buildNavigateBreadcrumb = function( selectedObjects, occContext, data ) {
    let breadCrumbProvider = {};
    breadCrumbProvider.crumbs = [];

    let modelObject = _.last( selectedObjects );
    if( !modelObject || _.isEmpty( modelObject.props ) ) {
        return breadCrumbProvider;
    }
    breadCrumbProvider = exports.insertCrumbsFromModelObject( modelObject, breadCrumbProvider, occContext );

    if( breadCrumbProvider && breadCrumbProvider.crumbs && breadCrumbProvider.crumbs.length > 0 ) {
        breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ].selectedCrumb = true;
        breadCrumbProvider.crumbs[ 0 ].primaryCrumb = true;
    }
    if( !isSameCrumb( data.crumbs, breadCrumbProvider.crumbs ) ) {
        data.dispatch( { path: 'data.crumbs', value: breadCrumbProvider.crumbs } );
    }
    return breadCrumbProvider;
};

let isSameCrumb = ( existingCrumbs, newCrumbs ) => {
    if( _.isUndefined( existingCrumbs ) ) {
        return false;
    }
    const existingCrumbsLength = Object.keys( existingCrumbs ).length;
    const newCrumbsLength = Object.keys( newCrumbs ).length;
    if( existingCrumbsLength !== newCrumbsLength ) {
        return false;
    }

    for( let i = 0; i < existingCrumbsLength; i++ ) {
        let existingCrumb = existingCrumbs[ i ];
        let newCrumb = newCrumbs[ i ];
        if( existingCrumb.scopedUid !== newCrumb.scopedUid || existingCrumb.displayName !== newCrumb.displayName || existingCrumb.selectedCrumb !== newCrumb.selectedCrumb ) {
            return false;
        }
    }
    return true;
};

//TODO: This event is no longer fired. Hence, need to clean this up.
export let updateChevronStateForInactiveView = function( contextKey ) {
    ctxStateMgmtService.updateActiveContext( contextKey );

    _.forEach( appCtxSvc.ctx.splitView.viewKeys, function( viewKey ) {
        if( appCtxSvc.ctx.aceActiveContext.key !== viewKey ) {
            var chevron = viewKey + 'Chevron';
            var chevronObject = appCtxSvc.getCtx( chevron );
            if( chevronObject && chevronObject.selected === false && chevronObject.clicked === true ) {
                chevronObject.clicked = false;
            }
        }
    } );
};

export default exports = {
    insertCrumbsFromModelObject,
    onSelectBreadcrumb,
    buildNavigateBreadcrumb,
    updateChevronStateForInactiveView,
    getSelectionForBreadcrumb
};
