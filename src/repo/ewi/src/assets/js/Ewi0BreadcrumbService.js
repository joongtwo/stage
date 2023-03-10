// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Ewi0BreadcrumbService
 */
import ewiService from 'js/ewiService';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';

let _workPackage = null;

/**
 * Create the breadcrumb links by getting the parents of the current step
 *
 * @param {IModelObject} modelObject - the current step model object
 * @param {Object} breadCrumbProvider - bread crumb provider
 *
 * @return {Object} bread crumb provider
 */
function insertCrumbsFromModelObject( modelObject, breadCrumbProvider ) {
    const objectDisplayName = TypeDisplayNameService.instance.getDisplayName( modelObject );

    const isShowArrow = modelObject.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrOperation' ) <= -1;
    if( modelObject && modelObject.props ) {
        const crumb = {
            displayName: objectDisplayName,
            showArrow: isShowArrow,
            scopedUid: modelObject.uid,
            clicked: false
        };

        crumb.onCrumbClick = function( selectedCrumb ) {
            ewiService.navigateToSelectedObject( selectedCrumb.scopedUid );
        };
        breadCrumbProvider.crumbs.splice( 0, 0, crumb );

        const parentUid = ewiService.getParentUid( modelObject );
        if( parentUid ) {
            const parentModelObj = cdm.getObject( parentUid );
            if( parentModelObj ) {
                return insertCrumbsFromModelObject( parentModelObj, breadCrumbProvider );
            }
        }
    }

    return breadCrumbProvider;
}

/**
 * Add the subLocation header title
 *
 * @param {Object} breadCrumbProvider - bread crumb provider
 * @param {IModelObject} workPackage - The workPackage model object
 *
 * @return {Object} bread crumb provider
 */
function addTitleToBreadcrumb( breadCrumbProvider, workPackage ) {
    _workPackage = workPackage;
    // Add the subLocation header title
    const title = workPackage.props.object_string.uiValues[ 0 ];
    const titleCrumb = {
        displayName: title,
        primaryCrumb: true,
        showArrow: true,
        selectedCrumb: true,
        scopedUid: workPackage.uid,
        clicked: false
    };
    breadCrumbProvider.crumbs.splice( 0, 0, titleCrumb );

    return breadCrumbProvider;
}

/**
 * Create the breadcrumb for the current step
 *
 * @param {IModelObject} currentStep - The current step model object
 * @param {IModelObject} workPackage - The workPackage model object
 *
 * @return {Object} breadCrumbProvider bread crumb provider
 */
function createBreadCrumbs( currentStep, workPackage ) {
    if( !currentStep.props ) {
        return;
    }

    let breadCrumbProvider = {};
    breadCrumbProvider.crumbs = [];

    breadCrumbProvider = insertCrumbsFromModelObject( currentStep, breadCrumbProvider );
    addTitleToBreadcrumb( breadCrumbProvider, workPackage );
    if( breadCrumbProvider.crumbs.length > 0 ) {
        breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ].selectedCrumb = true;
    }

    return {
        breadCrumbProvider: breadCrumbProvider
    };
}

/**
 * Get objects on chevron click
 *
 * @param {String} parentUid - The clicked chevron parent uid
 *
 * @returns {Object} totalChildCount & childOccurrences
 */
function onChevronClick( parentUid ) {
    //First chevron was clicked
    if( parentUid === _workPackage.uid ) {
        return {
            totalChildCount: 1,
            childOccurrences: [ ewiService.getTopLine() ]
        };
    }

    let required_props = [];
    const NOT_FOUND = -1;
    const parentObj = cdm.getObject( parentUid );
    if( parentObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessStation' ) > NOT_FOUND ) {
        required_props.push( 'Mfg0allocated_ops' );
    } else if( parentObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessPartition' ) > NOT_FOUND ) {
        required_props.push( 'bl_occgrp_visible_lines' );
    } else if( parentObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcess' ) > NOT_FOUND ) {
        required_props.push( 'Mfg0sub_elements' );
    } else if( parentObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessArea' ) > NOT_FOUND ) {
        required_props.push( 'Mfg0sub_elements' );
    }

    const input = {
        objects: [ parentObj ],
        attributes: required_props
    };
    return soaService.post( 'Core-2006-03-DataManagement', 'getProperties', input ).then( function( response ) {
        const obj = cdm.getObject( parentUid );
        let resultOp = null;
        if( obj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessStation' ) > -1 ) {
            resultOp = {
                listLoadResult: {
                    totalChildCount: obj.props.Mfg0allocated_ops.dbValues.length,
                    childOccurrences: obj.props.Mfg0allocated_ops.dbValues
                }
            };
        } else if( obj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcess' ) > -1 || obj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessArea' ) > -1 ) {
            resultOp = {
                listLoadResult: {
                    totalChildCount: obj.props.Mfg0sub_elements.dbValues.length,
                    childOccurrences: obj.props.Mfg0sub_elements.dbValues
                }
            };
        }
        let childOccModelObj = [];
        resultOp.listLoadResult.childOccurrences.forEach( ( childUid ) => {
            const childModelObj = cdm.getObject( childUid );
            childOccModelObj.push( childModelObj );
        } );
        return {
            totalChildCount: resultOp.listLoadResult.totalChildCount,
            childOccurrences: childOccModelObj
        };
    } );
}

export default {
    insertCrumbsFromModelObject,
    createBreadCrumbs,
    onChevronClick
};
