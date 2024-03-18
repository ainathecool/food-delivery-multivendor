import {
  useFocusEffect,
  useNavigation,
  useRoute
} from '@react-navigation/native'
import React, { useState, useContext, useEffect, useRef } from 'react'
import {
  View,
  TouchableOpacity,
  Alert,
  StatusBar,
  Platform,
  Image,
  Dimensions,
  SectionList,
  Text
} from 'react-native'
import Animated, {
  Extrapolate,
  interpolateNode,
  useValue,
  EasingNode,
  timing
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Placeholder,
  PlaceholderMedia,
  PlaceholderLine,
  Fade
} from 'rn-placeholder'
import ImageHeader from '../../components/Restaurant/ImageHeader'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import ConfigurationContext from '../../context/Configuration'
import UserContext from '../../context/User'
import { useRestaurant } from '../../ui/hooks'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { scale } from '../../utils/scaling'
import { theme } from '../../utils/themeColors'
import styles from './styles'
import { DAYS } from '../../utils/enums'
import { alignment } from '../../utils/alignment'
import TextError from '../../components/Text/TextError/TextError'
import { MaterialIcons } from '@expo/vector-icons'
import analytics from '../../utils/analytics'
import { gql, useApolloClient, useQuery } from '@apollo/client'
import { popularItems, food } from '../../apollo/queries'

import { useTranslation } from 'react-i18next'
import ItemCard from '../../components/ItemCards/ItemCards'
import { ScrollView } from 'react-native-gesture-handler'
import { IMAGE_LINK } from '../../utils/constants'

const { height } = Dimensions.get('screen')

// Animated Section List component
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList)
const TOP_BAR_HEIGHT = height * 0.05
const HEADER_MAX_HEIGHT = height * 0.3
const HEADER_MIN_HEIGHT = height * 0.07 + TOP_BAR_HEIGHT

const POPULAR_ITEMS = gql`
  ${popularItems}
`
const FOOD = gql`
  ${food}
`

function Restaurant(props) {
  const { _id: restaurantId } = props.route.params
  const Analytics = analytics()
  const { t } = useTranslation()
  const scrollRef = useRef(null)
  const flatListRef = useRef(null)
  const navigation = useNavigation()
  const route = useRoute()
  const propsData = route.params
  const animation = useValue(0)
  const circle = useValue(0)
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const configuration = useContext(ConfigurationContext)
  const [selectedLabel, selectedLabelSetter] = useState(0)
  const [buttonClicked, buttonClickedSetter] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterData, setFilterData] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const {
    restaurant: restaurantCart,
    setCartRestaurant,
    cartCount,
    addCartItem,
    addQuantity,
    clearCart,
    checkItemCart
  } = useContext(UserContext)
  const { data, refetch, networkStatus, loading, error } = useRestaurant(
    propsData._id
  )
  const client = useApolloClient()
  const { data: popularItems } = useQuery(POPULAR_ITEMS, {
    variables: { restaurantId }
  })

  const fetchFoodDetails = itemId => {
    return client.readFragment({ id: `Food:${itemId}`, fragment: FOOD })
  }

  const dataList =
    popularItems &&
    popularItems?.popularItems?.map(item => {
      const foodDetails = fetchFoodDetails(item.id)
      return foodDetails
    })

  const searchHandler = () => {
    setSearchOpen(!searchOpen)
    setShowSearchResults(!showSearchResults)
  }

  const searchPopupHandler = () => {
    setSearchOpen(!searchOpen)
    setSearch('')
  }

  useEffect(() => {
    if (search === '') {
      setFilterData([])
      setShowSearchResults(false)
    } else if (deals) {
      const regex = new RegExp(search, 'i')
      const filteredData = []
      deals.forEach(category => {
        category.data.forEach(deals => {
          const title = deals.title.search(regex)
          if (title < 0) {
            const description = deals.description.search(regex)
            if (description > 0) {
              filteredData.push(deals)
            }
          } else {
            filteredData.push(deals)
          }
        })
      })
      setFilterData(filteredData)
      setShowSearchResults(true)
    }
  }, [search, searchOpen])

  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(currentTheme.menuBar)
    }
    StatusBar.setBarStyle(
      themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
    )
  })
  useEffect(() => {
    async function Track() {
      await Analytics.track(Analytics.events.NAVIGATE_TO_RESTAURANTS)
    }
    Track()
  }, [])
  useEffect(() => {
    if (
      data &&
      data.restaurant &&
      (!data.restaurant.isAvailable || !isOpen())
    ) {
      Alert.alert(
        '',
        'Restaurant Closed at the moment',
        [
          {
            text: 'Go back to restaurants',
            onPress: () => {
              navigation.goBack()
            },
            style: 'cancel'
          },
          {
            text: 'See Menu',
            onPress: () => console.log('see menu')
          }
        ],
        { cancelable: false }
      )
    }
  }, [data])

  const isOpen = () => {
    if (data.restaurant.openingTimes?.length < 1) return false
    const date = new Date()
    const day = date.getDay()
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const todaysTimings = data.restaurant.openingTimes.find(
      o => o.day === DAYS[day]
    )
    if (todaysTimings === undefined) return false
    const times = todaysTimings.times.filter(
      t =>
        hours >= Number(t.startTime[0]) &&
        minutes >= Number(t.startTime[1]) &&
        hours <= Number(t.endTime[0]) &&
        minutes <= Number(t.endTime[1])
    )

    return times.length > 0
  }
  const onPressItem = async food => {
    if (!data.restaurant.isAvailable || !isOpen()) {
      Alert.alert(
        '',
        'Restaurant Closed at the moment',
        [
          {
            text: 'Go back to restaurants',
            onPress: () => {
              navigation.goBack()
            },
            style: 'cancel'
          },
          {
            text: 'See Menu',
            onPress: () => console.log('see menu')
          }
        ],
        { cancelable: false }
      )
      return
    }
    if (!restaurantCart || food.restaurant === restaurantCart) {
      await addToCart(food, food.restaurant !== restaurantCart)
    } else if (food.restaurant !== restaurantCart) {
      Alert.alert(
        '',
        t('clearCartText'),
        [
          {
            text: t('Cancel'),
            onPress: () => console.log('Cancel Pressed'),
            style: 'cancel'
          },
          {
            text: t('okText'),
            onPress: async() => {
              await addToCart(food, true)
            }
          }
        ],
        { cancelable: false }
      )
    }
  }

  function wrapContentAfterWords(content, numWords) {
    const words = content.split(' ')
    const wrappedContent = []

    for (let i = 0; i < words.length; i += numWords) {
      wrappedContent.push(words.slice(i, i + numWords).join(' '))
    }

    return wrappedContent.join('\n')
  }

  const addToCart = async(food, clearFlag) => {
    if (
      food?.variations?.length === 1 &&
      food?.variations[0].addons?.length === 0
    ) {
      await setCartRestaurant(food.restaurant)
      const result = checkItemCart(food._id)
      if (result.exist) await addQuantity(result.key)
      else await addCartItem(food._id, food.variations[0]._id, 1, [], clearFlag)
      animate()
    } else {
      if (clearFlag) await clearCart()
      navigation.navigate('ItemDetail', {
        food,
        addons: restaurant.addons,
        options: restaurant.options,
        restaurant: restaurant._id
      })
    }
  }

  function tagCart(itemId) {
    if (checkItemCart) {
      const cartValue = checkItemCart(itemId)
      if (cartValue.exist) {
        return (
          <>
            <View style={styles(currentTheme).triangleCorner} />
            <TextDefault
              style={styles(currentTheme).tagText}
              numberOfLines={1}
              textColor={currentTheme.fontWhite}
              bold
              small
              center>
              {cartValue.quantity}
            </TextDefault>
          </>
        )
      }
    }
    return null
  }

  // button animation
  function animate() {
    timing(circle, {
      toValue: 1,
      duration: 500,
      easing: EasingNode.inOut(EasingNode.ease)
    }).start()
    circle.setValue(0)
  }

  const scrollToSection = index => {
    if (scrollRef.current != null) {
      scrollRef.current.scrollToLocation({
        animated: true,
        sectionIndex: index,
        itemIndex: 0
      })
    }
  }

  function changeIndex(index) {
    if (selectedLabel !== index) {
      selectedLabelSetter(index)
      buttonClickedSetter(true)
      scrollToSection(index)
      scrollToNavbar(index)
    }
  }
  function scrollToNavbar(value = 0) {
    if (flatListRef.current != null) {
      flatListRef.current.scrollToIndex({
        animated: true,
        index: value,
        viewPosition: 0.5
      })
    }
  }

  function onViewableItemsChanged({ viewableItems }) {
    buttonClickedSetter(false)
    if (viewableItems.length === 0) return
    if (
      selectedLabel !== viewableItems[0].section.index &&
      buttonClicked === false
    ) {
      console.log('IFIFIFIi')
      selectedLabelSetter(viewableItems[0].section.index)
      scrollToNavbar(viewableItems[0].section.index)
    }
  }

  // Important
  const headerHeight = interpolateNode(animation, {
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: Extrapolate.CLAMP
  })

  const iconColor = currentTheme.iconColorPink

  const iconBackColor = currentTheme.white

  const iconRadius = scale(15)

  const iconSize = scale(20)

  const iconTouchHeight = scale(30)

  const iconTouchWidth = scale(30)

  const circleSize = interpolateNode(circle, {
    inputRange: [0, 0.5, 1],
    outputRange: [scale(18), scale(24), scale(18)],
    extrapolate: Extrapolate.CLAMP
  })
  const radiusSize = interpolateNode(circle, {
    inputRange: [0, 0.5, 1],
    outputRange: [scale(9), scale(12), scale(9)],
    extrapolate: Extrapolate.CLAMP
  })
  const fontChange = interpolateNode(circle, {
    inputRange: [0, 0.5, 1],
    outputRange: [scale(8), scale(12), scale(8)],
    extrapolate: Extrapolate.CLAMP
  })

  if (loading) {
    return (
      <View style={[styles().flex]}>
        <ImageHeader
          iconColor={iconColor}
          iconSize={iconSize}
          height={headerHeight}
          iconBackColor={iconBackColor}
          iconRadius={iconRadius}
          iconTouchWidth={iconTouchWidth}
          iconTouchHeight={iconTouchHeight}
          restaurantName={propsData.name}
          restaurantId={propsData._id}
          restaurantImage={propsData.image}
          restaurant={null}
          topaBarData={[]}
          loading={loading}
          minimumOrder={propsData.minimumOrder}
          tax={propsData.tax}
          updatedDeals={[]}
          searchOpen={searchOpen}
          showSearchResults={showSearchResults}
          setSearch={setSearch}
          search={search}
          searchHandler={searchHandler}
          searchPopupHandler={searchPopupHandler}
        />

        <View
          style={[
            styles().navbarContainer,
            styles().flex,
            {
              paddingTop: HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT - TOP_BAR_HEIGHT
            }
          ]}>
          {Array.from(Array(10), (_, i) => (
            <Placeholder
              key={i}
              Animation={props => (
                <Fade
                  {...props}
                  style={{ backgroundColor: currentTheme.fontSecondColor }}
                  duration={600}
                />
              )}
              Left={PlaceholderMedia}
              style={{
                padding: 12
              }}>
              <PlaceholderLine width={80} />
              <PlaceholderLine width={80} />
            </Placeholder>
          ))}
        </View>
      </View>
    )
  }
  if (error) return <TextError text={JSON.stringify(error)} />
  const restaurant = data.restaurant
  const allDeals = restaurant.categories.filter(cat => cat?.foods?.length)
  const deals = allDeals.map((c, index) => ({
    ...c,
    data: c.foods,
    index: dataList?.length > 0 ? index+1 : index
  }))

  const updatedDeals = dataList?.length > 0 ? [
    {
      title: 'Popular',
      id: new Date().getTime(),
      data: dataList,
      index: 0
    },
    ...deals
  ] : [...deals]

  return (
    <>
      <SafeAreaView style={styles(currentTheme).flex}>
        <View style={styles(currentTheme).flex}>
          <ImageHeader
            ref={flatListRef}
            iconColor={iconColor}
            iconSize={iconSize}
            height={headerHeight}
            iconBackColor={iconBackColor}
            iconRadius={iconRadius}
            iconTouchWidth={iconTouchWidth}
            iconTouchHeight={iconTouchHeight}
            restaurantName={propsData.name}
            restaurantId={propsData._id}
            restaurantImage={propsData.image}
            restaurant={data.restaurant}
            topaBarData={updatedDeals}
            changeIndex={changeIndex}
            selectedLabel={selectedLabel}
            minimumOrder={propsData.minimumOrder}
            tax={propsData.tax}
            updatedDeals={updatedDeals}
            searchOpen={searchOpen}
            showSearchResults={showSearchResults}
            setSearch={setSearch}
            search={search}
            searchHandler={searchHandler}
            searchPopupHandler={searchPopupHandler}
          />

          {showSearchResults ? (
            <ScrollView>
              {filterData.map((item, index) => (
                <View key={index}>
                  <TouchableOpacity
                    style={styles(currentTheme).searchDealSection}
                    activeOpacity={0.7}
                    onPress={() =>
                      onPressItem({
                        ...item,
                        restaurant: restaurant._id,
                        restaurantName: restaurant.name
                      })
                    }>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                      <View style={styles(currentTheme).deal}>
                        {item?.image ? (
                          <Image
                            style={{
                              height: scale(60),
                              width: scale(60),
                              borderRadius: 30
                            }}
                            source={{ uri: item.image }}
                          />
                        ) : null}
                        <View style={styles(currentTheme).flex}>
                          <View style={styles(currentTheme).dealDescription}>
                            <TextDefault
                              textColor={currentTheme.fontMainColor}
                              style={styles(currentTheme).headerText}
                              numberOfLines={1}
                              bolder>
                              {item.title}
                            </TextDefault>
                            <TextDefault
                              style={styles(currentTheme).priceText}
                              small>
                              {wrapContentAfterWords(item.description, 5)}
                            </TextDefault>
                            <View style={styles(currentTheme).dealPrice}>
                              <TextDefault
                                numberOfLines={1}
                                textColor={currentTheme.fontMainColor}
                                style={styles(currentTheme).priceText}
                                bolder
                                small>
                                {configuration.currencySymbol}{' '}
                                {parseFloat(item.variations[0].price).toFixed(
                                  2
                                )}
                              </TextDefault>
                              {item.variations[0].discounted > 0 && (
                                <TextDefault
                                  numberOfLines={1}
                                  textColor={currentTheme.fontSecondColor}
                                  style={styles().priceText}
                                  small
                                  lineOver>
                                  {configuration.currencySymbol}{' '}
                                  {(
                                    item.variations[0].price +
                                    item.variations[0].discounted
                                  ).toFixed(2)}
                                </TextDefault>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles().addToCart}>
                        <MaterialIcons
                          name="add"
                          size={scale(20)}
                          color="#fff"
                        />
                      </View>
                    </View>
                    {/* )} */}
                    {tagCart(item._id)}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <AnimatedSectionList
              ref={scrollRef}
              sections={updatedDeals}
              scrollEventThrottle={1}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              refreshing={networkStatus === 4}
              onRefresh={() => networkStatus === 7 && refetch()}
              onViewableItemsChanged={onViewableItemsChanged}
              keyExtractor={(item, index) => item + index}
              contentContainerStyle={{ paddingBottom: 150 }}
              renderSectionHeader={({ section: { title, data } }) => {
                if (title === 'Popular') {
                  if (!dataList || dataList?.length === 0) {
                    return null // Don't render the section header if dataList is empty
                  }
                  return (
                    <View style={{ backgroundColor: '#fff' }}>
                      <TextDefault
                        style={styles(currentTheme).sectionHeaderText}
                        textColor="#111827"
                        bolder>
                        {title}
                      </TextDefault>
                      <Text
                        style={{
                          color: '#4B5563',
                          ...alignment.PLmedium,
                          fontSize: scale(12),
                          fontWeight: '400',
                          marginTop: scale(3)
                        }}>
                        Most ordered right now.
                      </Text>
                      <View style={styles().popularItemCards}>
                        {data.map(item => (
                          <ItemCard
                            key={item._id}
                            item={item}
                            onPressItem={onPressItem}
                            restaurant={restaurant}
                            tagCart={tagCart}
                          />
                        ))}
                      </View>
                    </View>
                  )
                }
                // Render other section headers as usual
                return (
                  <View style={{ backgroundColor: '#fff' }}>
                    <TextDefault
                      style={styles(currentTheme).sectionHeaderText}
                      textColor="#111827"
                      bolder>
                      {title}
                    </TextDefault>
                  </View>
                )
              }}
              renderItem={({ item, section }) => {
                const imageUrl =
                  item.image && item.image.trim() !== ''
                    ? item.image
                    : IMAGE_LINK
                if (section.title === 'Popular') {
                  if (!dataList || dataList?.length === 0) {
                    return null
                  }
                  return null
                }
                return (
                  <TouchableOpacity
                    style={styles(currentTheme).dealSection}
                    activeOpacity={0.7}
                    onPress={() =>
                      onPressItem({
                        ...item,
                        restaurant: restaurant._id,
                        restaurantName: restaurant.name
                      })
                    }>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                      <View style={styles(currentTheme).deal}>
                          <Image
                            style={{
                              height: scale(60),
                              width: scale(60),
                              borderRadius: 30
                            }}
                          source={{ uri: imageUrl }}
                          />
                        <View style={styles(currentTheme).flex}>
                          <View style={styles(currentTheme).dealDescription}>
                            <TextDefault
                              textColor={currentTheme.fontMainColor}
                              style={styles(currentTheme).headerText}
                              numberOfLines={1}
                              bolder>
                              {item.title}
                            </TextDefault>
                            <TextDefault
                              style={styles(currentTheme).priceText}
                              small>
                              {wrapContentAfterWords(item.description, 5)}
                            </TextDefault>
                            <View style={styles(currentTheme).dealPrice}>
                              <TextDefault
                                numberOfLines={1}
                                textColor={currentTheme.fontMainColor}
                                style={styles(currentTheme).priceText}
                                bolder
                                small>
                                {configuration.currencySymbol}{' '}
                                {parseFloat(item.variations[0].price).toFixed(
                                  2
                                )}
                              </TextDefault>
                              {item.variations[0].discounted > 0 && (
                                <TextDefault
                                  numberOfLines={1}
                                  textColor={currentTheme.fontSecondColor}
                                  style={styles().priceText}
                                  small
                                  lineOver>
                                  {configuration.currencySymbol}{' '}
                                  {(
                                    item.variations[0].price +
                                    item.variations[0].discounted
                                  ).toFixed(2)}
                                </TextDefault>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles().addToCart}>
                        <MaterialIcons
                          name="add"
                          size={scale(20)}
                          color="#fff"
                        />
                      </View>
                    </View>
                    {/* )} */}
                    {tagCart(item._id)}
                  </TouchableOpacity>
                )
              }}
            />
          )}
          {/* </View> */}

          {cartCount > 0 && (
            <View style={styles(currentTheme).buttonContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles(currentTheme).button}
                onPress={() => navigation.navigate('Cart')}>
                <View style={styles().buttontLeft}>
                  <Animated.View
                    style={[
                      styles(currentTheme).buttonLeftCircle,
                      {
                        width: circleSize,
                        height: circleSize,
                        borderRadius: radiusSize
                      }
                    ]}>
                    <Animated.Text
                      style={[
                        styles(currentTheme).buttonTextLeft,
                        { fontSize: fontChange }
                      ]}>
                      {cartCount}
                    </Animated.Text>
                  </Animated.View>
                </View>
                <TextDefault
                  style={styles().buttonText}
                  textColor={currentTheme.buttonTextPink}
                  uppercase
                  center
                  bolder
                  small>
                  {t('viewCart')}
                </TextDefault>
                <View style={styles().buttonTextRight} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  )
}

export default Restaurant
