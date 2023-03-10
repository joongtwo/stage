// Copyright (c) 2021 Siemens
// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/addElementCreateSubViewService
 */
import AwWidget from 'viewmodel/AwWidgetViewModel';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import AwXrt from 'viewmodel/AwXrtViewModel';
import _ from 'lodash';

export const addElementCreateSubViewRenderFunction = ( props ) => {
    const {
        fields,
        addElementState,
        addPanelState,
        numberOfElements
    } = props;

    const xrtType = 'CREATE';
    const objectType = 'PSOccurrence';
    var currentVal = addElementState.areNumberOfElementsInRange;
    var numberOfElementsValueInRange =  _.isUndefined( numberOfElements.error );
    var hasValueChanged = currentVal !== numberOfElementsValueInRange;

    if( hasValueChanged ) {
        var newAddElementState = { ...addElementState.value };
        newAddElementState.areNumberOfElementsInRange = numberOfElementsValueInRange;
        addElementState.update( newAddElementState );
    }

    var isNewTabSelected = _.isEqual( addPanelState.value.selectedTab.view, 'NewTabPageSub' );
    var isAwb0ElementSelected = addPanelState.value.sourceObjects !== null && addPanelState.value.sourceObjects.length > 0 && addPanelState.value.sourceObjects[0].modelType && addPanelState.value.sourceObjects[0].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1;
    var subPanelXrtApplicable = _.isEqual( isAwb0ElementSelected, false ) || isNewTabSelected;

    if( subPanelXrtApplicable ) {
        return (
            //Styles applied on AwXrt & AwWdiget are different...so, need style adjustment (aw-occmgmt-elementPropPanel) for alignment.
            //<AwPanelSection className='aw-occmgmt-elementPropPanel'>
            //Fix - approach 1 - override sw-section-content in 'aw-occmgmt-elementPropPanel'
            //Fix - approach 2 : apply sw-section-content on AwWidget
            <AwPanelSection>
                <AwWidget className='sw-section-content' {...numberOfElements}></AwWidget>
                <AwXrt type={xrtType} objectType={objectType} xrtState={fields.xrtState}></AwXrt>
            </AwPanelSection>
        );
    }

    return (
        <AwPanelSection>
            <AwWidget className='sw-section-content' {...numberOfElements}></AwWidget>
        </AwPanelSection>
    );
};
