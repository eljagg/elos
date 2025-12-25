import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const MenuPage = () => {
  const { t } = useTranslation();
  const [mealType, setMealType] = useState('lunch');
  const [cart, setCart] = useState([]);

  const sampleMenu = [
    { category: 'Proteins', items: [{ id: 1, name: 'Jerk Chicken', price: 850 }, { id: 2, name: 'Brown Stew Fish', price: 950 }] },
    { category: 'Carbohydrates', items: [{ id: 3, name: 'Rice & Peas', price: 300 }, { id: 4, name: 'Festival', price: 150 }] },
    { category: 'Vegetables', items: [{ id: 5, name: 'Steamed Vegetables', price: 250 }, { id: 6, name: 'Garden Salad', price: 300 }] },
  ];

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    else setCart([...cart, { ...item, qty: 1 }]);
    toast.success('Added ' + item.name);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap justify-between items-center gap-4">
        <h1 className="page-title">{t('nav.menu')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setMealType('breakfast')} className={'px-4 py-2 rounded-lg ' + (mealType === 'breakfast' ? 'bg-primary-600 text-white' : 'bg-gray-100')}>{t('employee.breakfast')}</button>
          <button onClick={() => setMealType('lunch')} className={'px-4 py-2 rounded-lg ' + (mealType === 'lunch' ? 'bg-primary-600 text-white' : 'bg-gray-100')}>{t('employee.lunch')}</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {sampleMenu.map(cat => (
            <div key={cat.category} className="card">
              <h3 className="text-lg font-bold mb-4">{cat.category}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {cat.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div><div className="font-medium">{item.name}</div><div className="text-sm text-gray-500">${(item.price/100).toFixed(2)}</div></div>
                    <button onClick={() => addToCart(item)} className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700">+</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="card sticky top-24 h-fit">
          <h3 className="text-lg font-bold mb-4">🛒 Your Order</h3>
          {cart.length === 0 ? <p className="text-gray-500 text-sm">Your cart is empty</p> : (
            <div>
              <ul className="space-y-2 mb-4">{cart.map(item => (<li key={item.id} className="flex justify-between"><span>{item.name} x {item.qty}</span><span>${((item.price * item.qty)/100).toFixed(2)}</span></li>))}</ul>
              <div className="border-t pt-4"><div className="flex justify-between font-bold mb-4"><span>Total</span><span>${(cartTotal/100).toFixed(2)}</span></div><button className="btn-primary w-full">{t('employee.placeOrder')}</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuPage;
