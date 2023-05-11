dev:
	docker compose up build
	docker compose up mysql redis web
	docker compose down

clean:
	rm -rf src/laravel/composer.lock
	rm -rf src/laravel/vendor
	rm -rf tmp/*/
