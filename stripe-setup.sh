#!/bin/bash
# Crée les produits et prix Stripe pour Choisissons
# Usage: STRIPE_SECRET_KEY=sk_test_... bash stripe-setup.sh

KEY=${STRIPE_SECRET_KEY:?'Définis STRIPE_SECRET_KEY=sk_test_...'}
API="https://api.stripe.com/v1"

echo "==> Création du produit Citoyen..."
CITOYEN=$(curl -s -X POST "$API/products" \
  -u "$KEY:" \
  -d "name=Citoyen" \
  -d "description=Accès complet sans publicité, badge citoyen soutenant, newsletter mensuelle" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    product_id: $CITOYEN"

echo "==> Création du prix Citoyen (2€/mois)..."
PRICE_CITOYEN=$(curl -s -X POST "$API/prices" \
  -u "$KEY:" \
  -d "product=$CITOYEN" \
  -d "unit_amount=200" \
  -d "currency=eur" \
  -d "recurring[interval]=month" \
  -d "nickname=citoyen_mensuel" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    price_id: $PRICE_CITOYEN"

echo ""
echo "==> Création du produit Commune..."
COMMUNE=$(curl -s -X POST "$API/products" \
  -u "$KEY:" \
  -d "name=Commune & Collectivité" \
  -d "description=API données, tableau de bord élus, consultation citoyenne intégrée" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    product_id: $COMMUNE"

echo "==> Création du prix Commune petite (49€/mois, <5000 hab)..."
PRICE_COMMUNE_S=$(curl -s -X POST "$API/prices" \
  -u "$KEY:" \
  -d "product=$COMMUNE" \
  -d "unit_amount=4900" \
  -d "currency=eur" \
  -d "recurring[interval]=month" \
  -d "nickname=commune_petite" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    price_id: $PRICE_COMMUNE_S"

echo "==> Création du prix Commune moyenne (149€/mois, 5k-50k hab)..."
PRICE_COMMUNE_M=$(curl -s -X POST "$API/prices" \
  -u "$KEY:" \
  -d "product=$COMMUNE" \
  -d "unit_amount=14900" \
  -d "currency=eur" \
  -d "recurring[interval]=month" \
  -d "nickname=commune_moyenne" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    price_id: $PRICE_COMMUNE_M"

echo "==> Création du prix Commune grande (499€/mois, >50k hab)..."
PRICE_COMMUNE_L=$(curl -s -X POST "$API/prices" \
  -u "$KEY:" \
  -d "product=$COMMUNE" \
  -d "unit_amount=49900" \
  -d "currency=eur" \
  -d "recurring[interval]=month" \
  -d "nickname=commune_grande" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "    price_id: $PRICE_COMMUNE_L"

echo ""
echo "======================================"
echo "Copie ces valeurs dans ton .env.local :"
echo "======================================"
echo "STRIPE_PRICE_CITOYEN=$PRICE_CITOYEN"
echo "STRIPE_PRICE_COMMUNE_S=$PRICE_COMMUNE_S"
echo "STRIPE_PRICE_COMMUNE_M=$PRICE_COMMUNE_M"
echo "STRIPE_PRICE_COMMUNE_L=$PRICE_COMMUNE_L"
echo "======================================"
