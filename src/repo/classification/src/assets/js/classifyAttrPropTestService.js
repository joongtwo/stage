// Copyright (c) 2022 Siemens

import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import modelPropertySvc from 'js/modelPropertyService';
import AwCheckbox from 'viewmodel/AwCheckboxViewModel';
import AwClsSimpleProperty from 'viewmodel/AwClsSimplePropertyViewModel';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';

var exports = {};

const renderVmp = ( vmp, index, prop, classifyState, propDetails ) => {
    return (
        <div key={index}>
            <AwClsSimpleProperty attr={vmp} anno={prop.anno1}
                classifyState={classifyState}
                propDetails= {propDetails} />
        </div>
    );
};

const renderVmps = ( fields, prop, classifyState, propDetails ) => {
    return Object.entries( fields.vmparray ).map( ( [ key, vmp ], index ) => renderVmp( vmp, index, prop, classifyState, propDetails ) );
};

const renderAttr = ( attr, index, prop, classifyState, propDetails ) => {
    if ( attr && attr.propName ) {
        return (
            <div key={index}>
                <AwClsSimpleProperty attr={attr} anno={prop.anno1}
                    classifyState={classifyState}
                    propDetails= {propDetails}/>
            </div>
        );
    }
};

const renderArray = ( fields, prop, classifyState, propDetails ) => {
    return Object.entries( fields.testAttributes.attrs ).map( ( [ key, vmp ], index ) => renderAttr( vmp, index, prop, classifyState, propDetails ) );
};


export const initVmps = function() {
    var attrArray = [
        {
            displayName: 'Test Attribute 11',
            dbValue: 'Test 11',
            propName: 'render Attr1',
            type: 'STRING',
            labelPosition: 'PROPERTY_LABEL_AT_SIDE'
        },
        {
            displayName: 'Test Attribute 12',
            dbValue: 'Test 12',
            propName: 'render Attr2',
            type: 'STRING',
            labelPosition: 'PROPERTY_LABEL_AT_SIDE'
        }
    ];
    var vmparray = [];
    _.forEach( attrArray, function( attr ) {
        var prop = modelPropertySvc.createViewModelProperty( attr );
        // prop.isEditable = true;
        // prop.labelPosition = 'PROPERTY_LABEL_AT_SIDE';
        vmparray.push( prop );
    } );
    return vmparray;
};

export const lazyUpdate = ( attributes ) => {
    if( attributes.attrs ) {
        // const activeSelectedFiltersMap = getSelectedFiltersMap( searchState.categories );
        // let searchCriteria = AwStateService.instance.params.searchCriteria;
        // const filterString = searchFilterService.buildFilterString( activeSelectedFiltersMap );
        // if( searchState.filterString !== filterString ) {
        //     const activeFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( activeSelectedFiltersMap );
        //     searchState.update( { ...searchState, filterString, activeFilters: activeFiltersInfo.activeFilters, activeFilterMap: activeFiltersInfo.activeFilterMap } );
        //     searchFilterService.doSearch( 'teamcenter_search_search', searchCriteria, activeSelectedFiltersMap );
        // }
    }
};

let debounceUpdate = _.debounce( ( attributes ) => {
    lazyUpdate( attributes );
}, 800 );

export const update = ( attributes ) => {
    debounceUpdate( attributes );
};
export const initAttributes = function( testAttributes ) {
    var attrArray = [
        {
            displayName: 'Test Attribute 21',
            dbValue: 'Test 21',
            labelPosition: 'PROPERTY_LABEL_AT_SIDE',
            propName: 'render Attr1',
            type: 'STRING'
        },
        {
            displayName: 'Test Attribute 22',
            dbValue: 'Test 22',
            labelPosition: 'PROPERTY_LABEL_AT_SIDE',
            propName: 'render Attr2',
            type: 'STRING'
        }
    ];

    var newAttrArray = [];
    _.forEach( attrArray, function( attr ) {
        newAttrArray.push(
            attr
        );
    } );

    return {
        attrs: newAttrArray
    };
};

export const ClsAttrPropTestRenderFunction = ( { fields, viewModel, formProp } ) => {
    const { linkOptions, ...prop } = fields;

    const unitsProvider = viewModel.dataProviders.unitLinkDataProvider;
    const showAnno = prop.showanno.value === true;
    const showProp = prop.showallprop.value === true;

    let ctx = appCtxSvc.ctx;
    ctx.clsTab = {
        classifyshowAnnotations: true
    };
    appCtxSvc.registerCtx( 'clsTab', ctx.clsTab );
    const view = prop.panelMode.fielddata.uiValue;
    const createMode = prop.showmode.value === true;

    fields.attr1.disabled = !createMode;
    fields.attr1.fielddata.isEditable = createMode;
    fields.attr2.disabled = !createMode;
    fields.attr2.fielddata.isEditable = createMode;
    fields.attr3.disabled = !createMode;
    fields.attr3.fielddata.isEditable = createMode;
    fields.attr4.disabled = !createMode;
    fields.attr4.fielddata.isEditable = createMode;
    _.forEach( fields.vmparray, function( vmp ) {
        vmp.disabled = !createMode;
        vmp.fielddata.isEditable = createMode;
    } );

    let panelMode = createMode ? 0 : -1;
    let selectedClass = {
        showAllProp: showProp,
        showAnno: showAnno,
        hasAnno: true
    };

    let classifyState = {
        value: {
            panelMode: panelMode,
            selectedClass: selectedClass
        },
        selectedClass: selectedClass
    };

    let propDetails = {
        parentAttribute: fields.attr1
    };

    return (

        <div className='aw-clspanel-tester-top' >
            <AwCommandPanelSection caption='Test AwClsAttr'>
                <span >
                    <AwCheckbox className='aw-clspanel-tester-checkbox' {...prop.showmode} />
                </span>

                <AwClsSimpleProperty attr={fields.attr1} anno={prop.anno1}
                    classifyState={classifyState}
                    propDetails= {propDetails} />
                <AwClsSimpleProperty attr={fields.attr2} anno={prop.anno2}
                    classifyState={classifyState}
                    propDetails= {propDetails}
                    unitLink={fields.unitLink}
                    dataprovider={unitsProvider} />
                <AwClsSimpleProperty attr={fields.attr3} anno={prop.anno3}
                    classifyState={classifyState}
                    propDetails= {propDetails}/>
                <AwClsSimpleProperty attr={fields.attr4} anno={prop.anno4}
                    classifyState={classifyState}
                    propDetails= {propDetails}/>


                {prop.vmparray && renderVmps( fields, prop, classifyState, propDetails ) }

                {prop.testAttributes && prop.testAttributes.attrs && renderArray( fields, prop, classifyState, propDetails ) }

                <AwClsSimpleProperty attr={fields.attr6} anno={prop.anno6}
                    classifyState={classifyState}
                    propDetails= {propDetails}/>

            </AwCommandPanelSection>
        </div>
    );
};
