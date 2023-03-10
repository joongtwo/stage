// Copyright (c) 2022 Siemens

/**
 * This module provides access to service APIs which contains the logic for the classification contribution to the
 * compare & arrange panels. It primarily handles communication and syncing states between the compare and arrange
 * widgets.
 *
 * @module js/classificationPropsService
 */
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import classifySvc from 'js/classifyService';
import ClsEditPropsSvc from 'js/classifyEditPropsService';
import eventBus from 'js/eventBus';
import uwPropSvc from 'js/uwPropertyService';

let exports = {};

var ICS_SUBCLASS_NAME = 'ics_subclass_name';
var HIDE = 'HIDE';

var currentState = null;

var REGEX_CLASSIFY_PROP = new RegExp( '^CLS_ATTR:(-|)\\d+', 'i' );

/**
 * Removes any classification fields from the fieldList
 *
 * @param {Array} fieldList - The list of fields to remove classification fields from
 * @return {Array} the list of fields with all classification fields removed.
 */
export let removeClassificationFields = function( fieldList ) {
    //Remove any previously added classification properties. They may not be applicable to the currently selected items.
    _.forEach( fieldList, function( field ) {
        if( field && field.name && REGEX_CLASSIFY_PROP.test( field.name ) ) {
            _.remove( fieldList, field );
        }
    } );

    return fieldList;
};

/**
 * Called when the field definitions are set. If we're showing classification properties, they should be added
 * to the list and returned. Else return the list un-modified.
 *
 * @param {Array} fieldList - The incoming field list
 * @param {Boolean} showClassificationArrangePanel - TRUE for show classification arrange panel
 *
 * @return {Array} the field list with classification properties, or the original unmodified list.
 */
export let setFieldDefinitions = function( fieldList, showClassificationArrangePanel ) {
    if( showClassificationArrangePanel ) {
        showClassificationArrangePanel = false;
        //If we're set to show classification props, check to see if the 'master switch' is in place to enable/disable the properties.
        _.forEach( fieldList, function( field ) {
            if( field && field.name === ICS_SUBCLASS_NAME ) {
                showClassificationArrangePanel = true;
                return false;
            }
        } );
    }

    if( !showClassificationArrangePanel || currentState === HIDE ) {
        return exports.removeClassificationFields( fieldList );
    }

    return fieldList;
};

/**
 * Finish load classification properties
 *
 * @param {Array} classifiedObjectsMap - array of selected objects for compare
 * @param {Array} fieldList - array of field names
 * @param {Object} deferred - A promise object resolved with the classification properties if success or failure
 *            with a reason
 */
export let finishLoadClassificationProperties = function( classifiedObjectsMap, fieldList, deferred ) {
    // Trigger loadClassificationProperties SOA call
};

/**
 * Load classification properties
 *
 * @param {Array} selectedObjects - array of selected objects for compare
 * @param {Array} fieldList - array of field names
 *
 * @return {Promise} A promise object resolved with the classification properties
 */
export let loadClassificationProperties = function( selectedObjects, fieldList ) {
    var deferred = AwPromiseService.instance.defer();

    var classifiedObjectsMap = {};
    _.forEach( selectedObjects, function( selObject ) {
        if( selObject ) {
            // Check if the object is classified.
            var subclassName = selObject.props.ics_subclass_name;
            if( subclassName ) {
                var stringDbValue = subclassName.value;
                if( subclassName.valueUpdated ) {
                    stringDbValue = subclassName.newValue;
                }

                if( stringDbValue === '' ) {
                    classifiedObjectsMap[ selObject.uid ] = selObject;
                }
            }
        }
    } );

    //Less than 2 classified objects. Don't load CLS props.
    if( _.keys( classifiedObjectsMap ).length < 2 ) {
        exports.removeClassificationFields( fieldList );
        exports.setFieldDefinitions( fieldList, true );

        deferred.resolve( null );
        return;
    }

    exports.finishLoadClassificationProperties( classifiedObjectsMap, fieldList, deferred );

    return deferred.promise;
};

/**
 * Tells the edit properties display to save the current information by updating the classify state.
 *
 * @param {Object} context - The context to update with the message to save.
 */
export let tellPropsToSave = function( context, saveFlag ) {
    if ( context.value ) {
        const tmpContext = { ...context.value };
        tmpContext.shouldSaveEdits = saveFlag;
        tmpContext.shouldSave = saveFlag;
        context.update( tmpContext );
        return;
    }
    context.shouldSaveEdits = saveFlag;
    context.shouldSave = true;
    return context;
};

/**
 * Tells the edit properties display to not save the current information. Updates the context to do so.
 * @param {Object} context - The context to update to prevent saving.
 * @returns {Object} context - updated context
 */
let updateContextNotToSaveEdits = function( context ) {
    if( context.standaloneExists && context.standaloneExists === true ) {
        context.standaloneExists = false;
        context.cancelStandAlone = true;
    }
    ClsEditPropsSvc.removeEditHandler();
    eventBus.publish( 'classify.loadCells' );
    eventBus.publish( 'classifyTab.cancelEdit' );
    return context;
};


/**
 * Fetch all of the vmps available for a given classification object.
 *
 * @param {Object} commandContext - The context change to edit mode.
 */
export let clearClsVmps = function( commandContext ) {
    const tmpContext = { ...commandContext.value };
    let attrs = tmpContext.attrs;
    //Clear only selected property group children

    if  ( tmpContext.selectedPropertyGroup ) {
        attrs = [];
        let propGrp = tmpContext.selectedPropertyGroup[0];
        attrs.push( propGrp );

        let propGrpId = propGrp.id;
        var instIndex = propGrpId.lastIndexOf( '*' );
        // add cardinal controller too if present
        if ( instIndex === -1 && propGrp.cardinalController ) {
            attrs.push( propGrp.cardinalController );
        }
    }

    const [ regularAttrs, irregularAttrs ] = sortAttrs( attrs );
    var vmpList = fetchVmps( regularAttrs );

    _.forEach( irregularAttrs, function( irregAttr ) {
        vmpList = vmpList.concat( fetchVmps( findVmpsAtRoot( irregAttr, false, tmpContext ) ) );
    } );

    _.forEach( vmpList, function( vmp ) {
        if ( vmp.type === 'BOOLEAN' ) {
            let tempVal = false;
            vmp.dbValue = vmp.isArray ? [ tempVal ] : tempVal;
            vmp.value = [ tempVal ];
            vmp.displayValues = [ tempVal ];
        } else {
            uwPropSvc.setValue( vmp, vmp.isArray ? [] : '' );
        }
        if ( vmp.hasLov ) {
            vmp.uiValue = '';
            vmp.lovApi.lovUpdated = true;
        }
    } );

    commandContext.update( tmpContext );
};

/**
 * fetch vmp properties of given list of properties.
 * @param {Array} propList list of attributes with vmp's.
 * @param {Boolean} editFlag true if edit operation, false otherwise
 * @param {Object} context classify state
 * @returns {Array} propList
 */
const findVmpsAtRoot = function( propList, editFlag, context ) {
    var rootVmps = [];

    if ( propList.cardinalController && propList.instances.length > 0 ) {
        //if one of the instance is seleted, do not clear cardinality.
        //if editmode, pass the number instances. For clear, clear cardinality
        if ( !context.selectedPropertyGroup  )  {
            //if editmode, pass the number instances. For clear, clear cardinality
            classifySvc.getCardinalInstances( editFlag ? propList.instances.length : 0, propList );
        } else {
            let updateInstances = context.selectedPropertyGroup[0].id === propList.id;
            if ( propList.prefix !== '' ) {
                let idChunks = propList.prefix.split( '.' );
                let idx = _.findIndex( idChunks, function( id ) {
                    return id === context.selectedPropertyGroup[0].id;
                } );
                if ( idx !== -1 ) {
                    updateInstances = true;
                }
            }
            if ( updateInstances ) {
                classifySvc.getCardinalInstances( editFlag ? propList.instances.length : 0, propList );
            }
        }

        //Ensure all instance children are accounted for
        _.forEach( propList.instances, function( propInstance ) {
            if( propInstance.children ) {
                rootVmps = rootVmps.concat( findVmpsAtRoot( propInstance, editFlag, context ) );
            } else {
                rootVmps = rootVmps.concat( propInstance );
            }
        } );
    }
    if ( propList.polymorphicTypeProperty ) {
        rootVmps = rootVmps.concat( findVmpsAtRoot( propList.polymorphicTypeProperty, editFlag, context ) );
    }
    if( propList.children ) {
        _.forEach( propList.children, function( propChild ) {
            if( propChild.children ) {
                rootVmps = rootVmps.concat( findVmpsAtRoot( propChild, editFlag, context ) );
            } else {
                rootVmps = rootVmps.concat( propChild );
            }
        } );
        return rootVmps;
    }
    return propList;
};

/**
 * fetch vmp properties of given attribute list.
 * @param {Array} attrs list of attributes with vmp's.
 * @returns {Array} attrs list of attributes with vmp's.
 */
export let fetchVmps = function( attrs ) {
    var vmpList = [];
    const collectProps = function( vmps, vmpList ) {
        var propList = [];
        _.forEach( vmps, function( propDef ) {
            //Have to deal with vmps that are used for dispalys...
            //TODO: The data mutation of unitProp on VMPs is an antipatterns and should be removed.
            if( !propDef.unitProp ) {
                propList.push( propDef );
            }
        } );
        return propList;
    };
    _.forEach( attrs, function( attr ) {
        vmpList = vmpList.concat( collectProps( attr.vmps, vmpList ) );
    } );
    if( attrs.vmps && !vmpList.length ) {
        vmpList = collectProps( attrs.vmps, vmpList );
    }
    return vmpList;
};

/**
 * Sorts attributes into regular and irregular properties.
 *
 * @param {Object} attrs - The attributes to be sorted.
 * @returns {Array} attrs of regular and irregular attributes.
 */
export let sortAttrs = function( attrs ) {
    var regularAttrs = [];
    var irregularAttrs = [];
    _.forEach( attrs, function( attr ) {
        if( attr.vmps ) {
            regularAttrs.push( attr );
        } else {
            irregularAttrs.push( attr );
        }
    } );
    return [ regularAttrs, irregularAttrs ];
};

/**
 * make editable function for AwClsProperties
 * @param {Array} attrs list of attributes for selected class
 * @returns {Array} attrs list of attributes.
 */
const fetchAttrsMadeEditable = function( attrs, context ) {
    var vmpList = [];
    _.forEach( attrs, function( attr ) {
        if ( attr.cardinalController && attr.instances.length > 0 ) {
            attr.instances = fetchInstChildren( attr, context );
        }
        vmpList = vmpList.concat( fetchVmps( findVmpsAtRoot( attr, true, context ) ) );
        _.forEach( vmpList, function( propDef ) {
            propDef.isEditable = true;
        } );
    } );
    return attrs;
};

const fetchInstChildren = function( attribute, context ) {
    let instChildren = [];
    _.forEach( attribute.instances, function( instance ) {
        instance.children = fetchAttrsMadeEditable( instance.children, context );
    } );
    return attribute.instances;
};

/**
 * Cardinal blocks are not assembled from VMPs. As a result, they need custom processing.
 * @param {Array} attrs list of attributes for selected class.
 * @returns {Array} attrs list of attributes.
*/
const fetchAllAttrs = function( attrs, context ) {
    var [ regularAttrs, irregularAttrs ] = sortAttrs( attrs );
    regularAttrs = fetchAttrsMadeEditable( regularAttrs, context );
    irregularAttrs = _.forEach( irregularAttrs, function( irregAttr ) {
        irregAttr.children = fetchAttrsMadeEditable( irregAttr.children, context );
        if ( irregAttr.cardinalController && irregAttr.instances.length > 0 ) {
            irregAttr.instances = fetchInstChildren( irregAttr, context );
        }
    } );
    return irregularAttrs.concat( regularAttrs );
};

/**
 * Switches the panel to edit mode.
 *
 * @param {Object} context - The context change to edit mode.
 */
export let startEditMode = function( context ) {
    let clsAttrs = context.attrs;
    const tmpContext = { ...context.value };
    tmpContext.panelMode = 1;
    tmpContext.cancelEdits = false;
    tmpContext.editProperties = true;
    tmpContext.attrs = fetchAllAttrs( clsAttrs, tmpContext );
    if ( tmpContext.selectedPropertyGroup ) {
        //ensure selected prop group gets updated
        let selectedPropGrp = _.forEach( tmpContext.selectedPropertyGroup, function( propGrp ) {
            propGrp.children = fetchAttrsMadeEditable( propGrp.children, tmpContext );
            if ( propGrp.cardinalController && propGrp.instances.length > 0 ) {
                propGrp.instances = fetchInstChildren( propGrp, tmpContext );
            }
        } );
        tmpContext.selectedPropertyGroup = selectedPropGrp;
    }
    context.update( tmpContext );
};

export default exports = {
    removeClassificationFields,
    setFieldDefinitions,
    finishLoadClassificationProperties,
    loadClassificationProperties,
    startEditMode,
    sortAttrs,
    fetchVmps,
    updateContextNotToSaveEdits,
    tellPropsToSave,
    clearClsVmps
};
