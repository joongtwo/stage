// Copyright (c) 2022 Siemens

/**
 * Helper service for pca0SummarySelections
 *
 * @module js/pca0SummarySelectionsService
 */

import _ from 'lodash';
import pca0Constants from 'js/Pca0Constants';
import Pca0SummaryFamilySelection from 'viewmodel/Pca0SummaryFamilySelectionViewModel';
import utils from 'js/configuratorUtils';

var exports = {};


/**
   * Rendering method
   *
   * @param {Object} props - props
   * @returns {Object} - Returns view
   */
export const pca0SummarySelectionsRenderFunction = ( props ) => {
    let subPanelContext = props.subPanelContext;
    let { fields, viewModel } = props;
    if( subPanelContext && props.fields ) {
        fields = { ...fields, ...props.fields };
    }

    let grouppedValues = _.groupBy( subPanelContext, 'familyUID' );

    const fetchEachFamily = ( family ) => {
        let displayName = family[0].familyDisplayName;
        if( _.get( family[0], 'modelType.typeHierarchyArray' ) && family[0].modelType.typeHierarchyArray.indexOf( pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL ) > -1 ) {
            displayName = utils.getFscLocaleTextBundle().productsTitle;
        }

        return (
            <Pca0SummaryFamilySelection focused={props.focused} family={family} displayName={displayName} key={family[0].familyUID} ></Pca0SummaryFamilySelection>
        );
    };

    const renderSelections = () => {
        if(  subPanelContext && subPanelContext.length > 0 ) {
            return (
                <div>
                    {
                        Object.values( grouppedValues ).map( ( family ) => fetchEachFamily( family ) )
                    }
                </div>
            );
        }
    };

    return (
        renderSelections()
    );
};


export default exports = {
    pca0SummarySelectionsRenderFunction
};
