// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/*global
 define
 */

/**
 * Defines {@link AwClsPropertiesService}
 *
 * @module js/AwClsPropertiesService
 */

import AwClsAttributeAnnotation from 'viewmodel/AwClsAttributeAnnotationViewModel';
import AwClsBlock from 'viewmodel/AwClsBlockViewModel';
import ClsEditPropsSvc from 'js/classifyEditPropsService';
import classifyTblSvc from 'js/classifyFullviewTableService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import classifyUtils from 'js/classifyUtils';

var exports = {};


export const initialize = function( attributes ) {
    return attributes;
};

export const dummyAction = ( ) => {
};


/**
 * Handles the reordering of table column instances
 *
 * @param {Object} attribute - attribute
 * @param {Object} dataProvider - dataProvider
 * @param {Object} classifyState - classifyState
 */
export const reorderInstances = function( attribute, dataProvider, classifyState ) {
    let columns = dataProvider.cols;
    let tmpArr = [];
    _.forEach( attribute.instances, function( instance ) {
        //find instance in columns
        var ind = _.findIndex( columns, function( col ) {
            return instance.name === col.propertyName;
        } );
        instance.cardIndex[ instance.cardIndex.length - 1 ] = ind;
        tmpArr[ ind - 1 ] = instance;
    } );
    attribute.instances = tmpArr;

    const tmpState = { ...classifyState.value };
    tmpState.attrs = classifyUtils.updateAttrsList(  classifyState.value.attrs, attribute );
    classifyState.update( tmpState );
};


/*
 * Updates the attribute on change of attribute cardinality
 *
 * @param {Object} cardinalAttribute - cardinal attribute
 * @param {Object} attrField - attribute field
 * @param {Object} dataProvider - dataProvider
 */
export const updateTableColumns = ( cardinalAttribute, attrField, dataProvider ) => {
    let { ...attribute } = cardinalAttribute;
    let loadedVmos = dataProvider.vmCollectionObj.vmCollection.loadedVMObjects;
    attribute.tableView = attrField.tableView;
    classifyTblSvc.updateInstanceData( loadedVmos, attribute );
    attrField.update( attribute );
};

/*
 * Updates the attribute on change of attribute cardinality
 *
 * @param {Object} attrField - attribute field
 * @param {Object} dataProvider - dataProvider
 * @param {Object} classifyState - classifyState
 */
export const updateInstanceData = ( attrField, dataProvider, classifyState ) => {
    let { ...attribute } = attrField;
    let loadedVmos = dataProvider.vmCollectionObj.vmCollection.loadedVMObjects;
    classifyTblSvc.updateInstanceData( loadedVmos, attribute );
    const tmpState = { ...classifyState.value };
    tmpState.attrs = classifyUtils.updateAttrsList(  classifyState.value.attrs, attribute );
    classifyState.update( tmpState );
};


/*
 * Handles toggle of table view/list view
 *
 * @param {Object} context - command context
 */
export const toggleCardinalityView = function( context ) {
    let { ...attribute } = context.attribute;
    let loadedVmos = context.gridProvider.dataProviderInstance.vmCollectionObj.vmCollection.loadedVMObjects;
    if( context.selectedBlockAttr && context.selectedBlockAttr.blockId === attribute.blockId ) {
        // if the attribute is same current block attr
        attribute.tableView = context.selectedBlockAttr.tableView;
        classifyTblSvc.updateInstanceData( loadedVmos, attribute );
        attribute.tableView = !context.selectedBlockAttr.tableView;
    }else{
        // if different attribute is selected
        attribute.tableView = true;
        let { ...currentAttr } = context.selectedBlockAttr;
        classifyTblSvc.updateInstanceData( loadedVmos, currentAttr );
        const tmpState = { ...context.classifyState.value };
        tmpState.attrs = classifyUtils.updateAttrsList(  context.classifyState.value.attrs, currentAttr );
        context.classifyState.update( tmpState );
    }

    context.selectedBlockAttr.update( attribute );
};

/*
 * Handles copying the data from table to the attribute vmps
 *
 * @param {Object} attribute - attribute
 * @param {Object} dataProvider - dataProvider
 * @param {Object} classifyState - classifyState
 */
export const copyBlockTableData = function( attribute, dataProvider, classifyState ) {
    if( attribute && attribute.tableView === true ) {
        let loadedVmos = dataProvider.vmCollectionObj.vmCollection.loadedVMObjects;
        classifyTblSvc.updateInstanceData( loadedVmos, attribute );
        const tmpState = { ...classifyState.value };
        tmpState.attrs = classifyUtils.updateAttrsList(  classifyState.attrs, attribute );
        classifyState.update( tmpState );
    }
};

/**
 * render function for AwClsProperties
 * @param {*} props props
 * @returns {JSX.Element} react component
 */
export const awClsPropsServiceRenderFunction = ( props ) => {
    var { attributes, classifyState, responseState, viewModel, fields } = props;

    var gridView = viewModel.grids.gridView;

    var selectedBlockAttr = fields.selectedBlockAttr;

    if ( classifyState.value.panelMode === 1 ) {
        ClsEditPropsSvc.addEditHandler( viewModel );
    }

    const renderAttributeInt = ( attribute ) => {
        const attrname = attribute.name;
        return (
            <AwClsAttributeAnnotation attr={attribute} attrname={attrname}
                classifyState={classifyState}
                responseState={responseState}>
            </AwClsAttributeAnnotation>
        );
    };

    const renderBlock = ( attribute ) => {
        let propDetails = {
            level: 0
        };

        return (
            <AwClsBlock attribute={attribute}
                propDetails= {propDetails}
                classifyState={classifyState}
                responseState={responseState}
                blockGridProvider={gridView}
                selectedBlockAttr={selectedBlockAttr} >
            </AwClsBlock>
        );
    };

    const renderAttribute = ( attribute ) => {
        var isAdmin = classifyState.value.isAdmin;
        if ( attribute.type !== 'Block' && !attribute.isCardinalControl || isAdmin ) {
            return (
                renderAttributeInt( attribute )
            );
        }
        if ( attribute.type === 'Block' ) {
            return (
                renderBlock( attribute )
            );
        }
    };

    const renderArray = ( attributes ) => {
        return Object.entries( attributes ).map( ( [ key, attr ], index ) => renderAttribute( attr ) );
    };

    return (
        <div className='aw-clspanel-properties h-12'>
            { attributes && renderArray( attributes ) }
        </div>
    );
};

export default exports = {
    copyBlockTableData,
    initialize,
    reorderInstances,
    toggleCardinalityView,
    updateInstanceData,
    updateTableColumns
};
