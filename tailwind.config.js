/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			nunito: ['var(--font-nunito)'],
  			inter: ['var(--font-inter)'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  safelist: [
    'bg-green-500', 'bg-red-500', 'bg-orange-500', 'bg-blue-500',
    'bg-green-100', 'bg-red-100', 'bg-orange-100', 'bg-blue-100',
    'bg-green-50', 'bg-red-50', 'bg-orange-50', 'bg-blue-50',
    'text-green-600', 'text-red-600', 'text-orange-600', 'text-blue-600',
    'text-green-700', 'text-red-700', 'text-orange-700', 'text-blue-700',
    'border-green-200', 'border-red-200', 'border-orange-200', 'border-blue-200',
    'border-green-500', 'border-red-500', 'border-orange-500', 'border-blue-500',
    'bg-purple-500', 'bg-purple-100', 'text-purple-600', 'text-purple-700',
    'border-purple-200', 'border-purple-500',
    'bg-emerald-500', 'bg-emerald-100', 'text-emerald-600', 'text-emerald-700',
    'bg-amber-500', 'bg-amber-100', 'text-amber-600', 'text-amber-700',
    'bg-rose-500', 'bg-rose-100', 'text-rose-600', 'text-rose-700',
    'bg-violet-500', 'bg-violet-100', 'text-violet-600',
    'bg-green-950/40', 'bg-red-950/40', 'bg-orange-950/40', 'bg-blue-950/40',
    'bg-purple-950/40', 'text-green-300', 'text-red-300', 'text-orange-300',
    'text-blue-300', 'text-purple-300', 'border-green-600', 'border-red-600',
    'border-orange-600', 'border-blue-600', 'border-purple-600',
    'light:bg-green-50', 'light:bg-red-50', 'light:bg-amber-50', 'light:bg-blue-50',
    'light:bg-purple-50', 'light:bg-gray-100', 'light:bg-gray-200', 'light:bg-gray-300',
    'light:text-green-700', 'light:text-red-700', 'light:text-amber-700', 'light:text-blue-700',
    'light:text-purple-700', 'light:text-gray-700', 'light:text-gray-800',
    'light:border-green-300', 'light:border-red-300', 'light:border-amber-300', 'light:border-blue-300',
    'light:border-purple-300', 'light:border-gray-300', 'dark:bg-green-950/40', 'dark:bg-red-950/40',
    'dark:bg-orange-950/40', 'dark:bg-blue-950/40', 'dark:bg-purple-950/40', 'dark:bg-secondary',
    'dark:text-green-300', 'dark:text-red-300', 'dark:text-orange-300', 'dark:text-blue-300',
    'dark:text-purple-300', 'dark:border-green-600', 'dark:border-red-600', 'dark:border-orange-600',
    'dark:border-blue-600', 'dark:border-purple-600', 'dark:hover:bg-secondary/80',
    'light:hover:bg-gray-300', 'light:text-secondary-foreground', 'dark:text-secondary-foreground',
  ],
  plugins: [require("tailwindcss-animate")],
}