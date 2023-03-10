// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0SummaryFamilySelectionService
 *
 * @module js/Pca0SummaryFamilySelectionService
 */
import Pca0SummaryFeatureSelection from 'viewmodel/Pca0SummaryFeatureSelectionViewModel';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';

var exports = {};

/**
 * SummarySelection component updated - scroll into view the added element
 * @param {Object} props - passed in props
 * @param {Object} elementRefList - element reference
 * */
export let pca0SummarySelectionComponentUpdated = function( props, elementRefList ) {
    if( props.focused && props.focused.summaryFocusedId === props.family[ 0 ].familyUID &&
        elementRefList.get( 'Pca0SummaryFamilySelection' ).current ) {
        const familyEl = elementRefList.get( 'Pca0SummaryFamilySelection' ).current;
        if( familyEl ) {
            familyEl.scrollIntoView( { behavior: 'smooth', block: 'center', inline: 'center' } );
        }
    }
};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0SummarySelectionsRenderFunction = ( props ) => {
    let { family, displayName, focused, elementRefList } = props;

    //the free form does not have a uid it is composed by family uid and value
    const getId = ( item ) => {
        if( item.uid === '_freeFormFeature_' || item.uid === '_unconfiguredFeature_' ) {
            return item.nodeID ? item.nodeID : item.familyUID + ':' + item.cellHeader1;
        }
        return item.uid;
    };

    const fetchEachValue = ( item, index ) => {
        if( focused ) {
            item.focused = focused.summaryFocusedId === getId( item );
        }
        return (
            <Pca0SummaryFeatureSelection {...item} key={item.familyUID + index} ></Pca0SummaryFeatureSelection>
        );
    };

    return (
        <AwCommandPanelSection alignment='HORIZONTAL'  key={family[0].familyUID } caption={displayName}
            anchor='SummaryPanelAnchor'  context={{ family: family[0] }} title={family[0].familyDisplayName} >
            <div ref={elementRefList.get( 'Pca0SummaryFamilySelection' )} >
                {
                    family.map( ( item, index ) => fetchEachValue( item, index ) )
                }
            </div>
        </AwCommandPanelSection>
    );
};

export default exports = {
    pca0SummarySelectionsRenderFunction,
    pca0SummarySelectionComponentUpdated
};
