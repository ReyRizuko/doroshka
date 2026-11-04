package app.dorozhka.music.di

import android.content.Context
import androidx.room.Room
import app.dorozhka.music.BuildConfig
import app.dorozhka.music.data.local.AppDatabase
import app.dorozhka.music.data.local.TrackDao
import app.dorozhka.music.data.remote.MusicApiService
import app.dorozhka.music.data.repository.MusicRepositoryImpl
import app.dorozhka.music.domain.repository.MusicRepository
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object StorageModule {
    @Provides @Singleton
    fun database(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "doroshka.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun trackDao(db: AppDatabase): TrackDao = db.trackDao()
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton fun json(): Json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    @Provides @Singleton
    fun okHttp(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    @Provides @Named("musicBaseUrl") fun baseUrl(): String = BuildConfig.MUSIC_API_BASE_URL

    @Provides @Singleton
    fun retrofit(client: OkHttpClient, json: Json): Retrofit {
        val base = BuildConfig.MUSIC_API_BASE_URL
        require(base.startsWith("https://") && base.endsWith("/")) {
            "MUSIC_API_BASE_URL must be an HTTPS URL ending with /"
        }
        return Retrofit.Builder().baseUrl(base).client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build()
    }

    @Provides @Singleton
    fun musicApi(retrofit: Retrofit): MusicApiService = retrofit.create(MusicApiService::class.java)
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton abstract fun bindMusicRepository(impl: MusicRepositoryImpl): MusicRepository
}
