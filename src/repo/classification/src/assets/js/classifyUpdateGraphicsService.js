/* eslint-disable max-lines */
/* eslint-disable no-bitwise */
// Copyright 2021 Siemens Product Lifecycle Management Software Inc.
/*
global
 define
 */

/**
 * This the service file for handling everything that is needed for the graphics panel in active workspace.
 *
 * @module js/classifyUpdateGraphicsService
 */

import _ from 'lodash';
import classifyDefinesService from 'js/classifyDefinesService';
import soaService from 'soa/kernel/soaService';

var exports = {};

/**
 * Method to organize empty properties for display in a table in graphics builder panel.
 *
 * @param {Array} emptyTemplatePartProperties - The Template Part properties which have not been filled out for the given class before the template is created.
 *
 * @param {Array} emptyPartFamilyTemplateProperties - The Part Family Template properties which have not been filled out for the given class before the template is created.
 *
 * @returns {Array} result - An array of property that are used by graphics builder but are not populated.
 */
export let createGraphicsBuilderTableProps = function( emptyTemplatePartProperties, emptyPartFamilyTemplateProperties ) {
    var result = [];
    let emptyProperties = emptyTemplatePartProperties ? emptyTemplatePartProperties : emptyPartFamilyTemplateProperties;
    _.forEach( emptyProperties, function( emptyProp ) {
        var emptyPropTableRow = {
            props: {
                id: {
                    uiValue: emptyProp.propertyIdentifier,
                    value: emptyProp.propertyIdentifier
                },
                annotation: {
                    uiValue: emptyProp.propertyAnnotation,
                    value: emptyProp.propertyAnnotation
                },
                name: {
                    uiValue: emptyProp.propertyName,
                    value: emptyProp.propertyName
                }
            }
        };
        result.push( emptyPropTableRow );
    } );
    return result;
};

/**
 * Method to divide up the two types of templates into separate arrays.
 *
 * @param {Array} templates - Information about the various templates available to a given classification.
 *
 * @returns {Object} result - Returns a JSO that contain 2 arrays partFamilyTemplates and templatePartTemplates. Which are populated with the Part Family Templates and Template Part Template.
 */
export let divideTemplateTypes = function( templates ) {
    var result = {};
    result.partFamilyTemplates = [];
    result.templatePartTemplates = [];
    _.forEach( templates, function( template ) {
        if( template.templateType === classifyDefinesService.ICS_PFT ) {
            result.partFamilyTemplates.push( template );
        } else {
            result.templatePartTemplates.push( template );
        }
    } );
    return result;
};

/**
 * Prepare the object to ask for graphics to be saved for.
 *
 * @param {Object} updateTarget - the target we are using. If defined, return part family. Else, return template object. type.
 * @param {Object} partFamilyVal - May be undefined. If undefined, do not return.
 * @param {Object} templateObjVal - May be undefined.
 *
 * @returns {String} UID - The template UID that is to be use in the save SOA call.
 */
export let prepTemplateObjectForGraphicsMsg = function( updateTarget, partFamilyVal, templateObjVal ) {
    if ( updateTarget ) {
        return partFamilyVal.templateObject.uid;
    }
    return templateObjVal.templateObject.uid;
};

/**
 * Prepare the object to ask for graphics to be saved for.
 *
 * @param {Object} updateTargetBtn - The radio button feild that needs to be initialized.
 * @param {Boolean} selectedButton - The Boolean value to Initialize the button to.
 *
 * @returns {Object} newUpdateTargetBtn - The initialized radio button.
 */
export let initializeUpdateGraphicsPanel = function( updateTargetBtn, selectedButton ) {
    let newUpdateTargetBtn = { ...updateTargetBtn };
    newUpdateTargetBtn.dbValue = selectedButton;
    return newUpdateTargetBtn;
};

/**
 * Return icouid for selected item
 *
 * @param {Object} icoResponse - getClassificationInfo3 response
 * @param {Object} wsoObj - subPanelContext selected item
 * @param {String} prevIcoUid - viewModel's already stored icoUid
 * @returns {Object} icouid
 */
export let getIcoUidForGB = function( icoResponse, wsoObj, prevIcoUid ) {
    let matched = false;
    let responseClsObjects = icoResponse && icoResponse.clsObjectDefs ? icoResponse.clsObjectDefs[1][0].clsObjects[0] : null;
    if( prevIcoUid ) {
        return prevIcoUid;
    }
    //Verify that ctx already have ico uid if yes return
    if( wsoObj.modelType.typeHierarchyArray[0].includes( 'icm0' ) ) {
        return wsoObj.uid;
    }
    //Verify that ctx's icoResponse contains clsObjects of currently selected object if yes return icoResponse's icouid
    if( icoResponse ) {
        _.forEach( responseClsObjects.properties, function( prop ) {
            if( prop.propertyId === 'ICO_ID' && prop.values[0].displayValue === wsoObj.cellHeader1 ) {
                matched = true;
            }
        } );
        if( matched ) {
            return responseClsObjects.clsObject.uid;
        }
    }
    //get ico uid for selected object
    if( wsoObj.uid ) {
        var workspaceObjects = [];
        workspaceObjects[0] = {
            uid: wsoObj.uid
        };

        var request = {
            workspaceObjects: workspaceObjects,
            searchCriterias: [ ],
            classificationDataOptions: classifyDefinesService.LOAD_CLASS_CHILDREN_ASC
        };

        return soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request ).then( function( response ) {
            return response.clsObjectDefs[1][0].clsObjects[0].clsObject.uid;
        } );
    }
};

export default exports = {
    createGraphicsBuilderTableProps,
    divideTemplateTypes,
    getIcoUidForGB,
    initializeUpdateGraphicsPanel,
    prepTemplateObjectForGraphicsMsg
};
