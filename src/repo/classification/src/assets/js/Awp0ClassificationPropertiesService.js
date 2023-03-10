// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/*global
 define
 */

/**
 * Defines {@link Awp0ClassificationPropertiesService}
 *
 * @module js/Awp0ClassificationPropertiesService
 */
import AwClsProperties from 'viewmodel/AwClsPropertiesViewModel';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import classifyDefineService from 'js/classifyDefinesService';
import classifyFilterUtils from 'js/classifyFilterUtils';
import localeSvc from 'js/localeService';

let exports = {};
let propTitle = '';
localeSvc.getLocalizedTextFromKey( 'ClassificationPanelMessages.properties', true ).then( result => propTitle = result );

/**
 * Handled that handles the necessary state changes that are needed to either expand or collapse the
 * @param {Object} commandContext - commandContext a.k.a. classifyState
 * @param {Bool} target - bool that determines if we are expanding(true) or collapsing(false)
 */
export let expandAndCollapseAllCmd = function( commandContext, target ) {
    let tmpCommandContext = { ...commandContext.value };
    let tmpAttrs = [ ...tmpCommandContext.attrs ];

    // Since the UI is driven by state changes in some use cases we will need to cause a state change.
    // Namely when a user has used the expand all command and then collapse individual block. If the user then clicks
    // expand all command again it will no change since the collapse property did not change. (The little toggle arrow does not affect any state)
    if ( tmpCommandContext.shouldRerenderForExpandCollapse !== undefined ) {
        tmpCommandContext.expandAllBlocks = tmpCommandContext.shouldRerenderForExpandCollapse;
        expandOrCollapseProps( tmpAttrs, tmpCommandContext.shouldRerenderForExpandCollapse );
        delete tmpCommandContext.shouldRerenderForExpandCollapse;
    } else {
        tmpCommandContext.shouldRerenderForExpandCollapse = target;
        expandOrCollapseProps( tmpAttrs, !tmpCommandContext.expandAllBlocks );
        tmpCommandContext.expandAllBlocks = !tmpCommandContext.expandAllBlocks;
    }

    tmpCommandContext.attrs = tmpAttrs;

    commandContext.update( tmpCommandContext );
};

/**
 *  Takes an array of cls attributes and a target and for every block property it will set the propExpanded to target.
 *  This function is call recursively for the cardinal block and there instances.
 *
 * @param {Array<classificationAttributes>} instances - An array of attributes that need checked if they should expand.
 * @param {Boolean} target - the Boolean representing if the properties should expand or collapse.
 */
function expandOrCollapseProps( instances, target ) {
    instances.forEach( ( attr ) => {
        if( attr.type === classifyDefineService.CLS_PROPERTY_TYPE_BLOCK ) {
            attr.propExpanded = target;

            if( attr.instances && attr.instances.length > 0 ) {
                expandOrCollapseProps( attr.instances, target );
            }

            if( attr.children && attr.children.length > 0 ) {
                expandOrCollapseProps( attr.children, target );
            }
        }
    } );
}

/*
  * Handles show/hide command
  */
export let updateOnCommands = function( data ) {
    let prop = { ...data };
    prop.dbValue = !prop.dbValue;
    return prop;
};

/*
  * Handles show/hide annotation command
  */
export let updateShowAnno = function( data, classifyState ) {
    const tmpState = { ...classifyState.value };
    tmpState.selectedClass.showAnno = !tmpState.selectedClass.showAnno;
    classifyState.update( tmpState );
    return updateOnCommands( data );
};

/*
  * Handles show/hide propperties command
  */
export let updateShowAllProp = function( data, classifyState ) {
    const tmpState = { ...classifyState.value };
    tmpState.selectedClass.showAllProp = !tmpState.selectedClass.showAllProp;
    classifyState.update( tmpState );
    return updateOnCommands( data );
};

/**
*   Handles show/hide showMandatory propperties command.
* @param {Object} data - The data of the view model that will be updated.
* @param {Object} classifyState - The state of object use for tracking the state of classification.
* @return {any} The update date object.
*/
export let showMandatory = function( data, classifyState ) {
    const tmpState = { ...classifyState.value };
    if( tmpState.selectedClass ) {
        tmpState.selectedClass.showMandatory = !tmpState.selectedClass.showMandatory;
        classifyState.update( tmpState );
        return updateOnCommands( data );
    }
};

/**
  * render function for Awp0ClassificationProperties
  * @param {*} props props
  * @returns {JSX.Element} react component
  */
export const awClassificationPropsServiceRenderFunction = ( props ) => {
    const {  fields, classifyState, responseState, ctxMin, viewModel, actions, i18n, vmo, ...prop } = props;
    let { data } = viewModel;
    let { propFilter } = data;

    var isAdmin = classifyState.value.isAdmin;
    var clsname = isAdmin ? 'aw-clsadmin-propSection h-12' : 'aw-clspanel-propSection h-12';
    var id = isAdmin ? 'aw-clsadmin-propSection' : 'aw-clspanel-propSection';
    let filteredAttributes;
    if( !isAdmin ) {
        //TODO. When required attributes and footer is implemented, remove ctx dependency
        ctxMin.clsTab = ctxMin.clsTab ? ctxMin.clsTab : {};
        ctxMin.clsTab.displayOnlyMandatoryAttr = false;

        data.attr_anno = classifyState.value.selectedPropertyGroup ? classifyState.value.selectedPropertyGroup : classifyState.value.attrs;

        filteredAttributes = classifyState.value.selectedPropertyGroup ? classifyFilterUtils.filterProperties( { attr_anno : classifyState.value.selectedPropertyGroup, propFilter :{
            dbValue : ''
        } }, false ) : classifyFilterUtils.filterProperties( data, false );
    } else{
        data.classifyPropCommands = '';
        data.attr_anno = classifyState.value.selectedPropertyGroup ? classifyState.value.selectedPropertyGroup[0].children : classifyState.value.plainAttrs;

        filteredAttributes = classifyState.value.selectedPropertyGroup ? classifyFilterUtils.filterProperties( { attr_anno : classifyState.value.selectedPropertyGroup[0].children, propFilter :{
            dbValue : ''
        } }, false ) : classifyFilterUtils.filterProperties( data, false );
    }

    return (

        <div className='h-12'>
            <AwCommandPanelSection caption={propTitle} anchor={data.classifyPropCommands}
                collapsed='false' className={clsname} id={id}
                context={{ data: data, classifyState: classifyState, responseState: responseState }} >

                <AwTextBox {...Object.assign( {}, fields.propFilter, { autocomplete:'off' } )} ></AwTextBox>
                <AwPanelBody>
                    <AwClsProperties
                        attributes={filteredAttributes}
                        classifyState={classifyState}
                        propFilter={fields.propFilter.value}
                        responseState={responseState}>
                    </AwClsProperties>
                </AwPanelBody>
            </AwCommandPanelSection>
        </div>
    );
};

export default exports = {
    awClassificationPropsServiceRenderFunction,
    expandAndCollapseAllCmd,
    showMandatory,
    updateShowAnno,
    updateShowAllProp
};
